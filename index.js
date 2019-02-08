const express = require('express')
const path = require('path')
const PORT = process.env.PORT || 5000
var MongoClient = require('mongodb').MongoClient
var mongo = require('mongodb')
var _ = require('lodash')
var jsonld = require('jsonld')
var $rdf = require('rdflib')
var csvtojson = require('csvtojson')
var mysql  = require('mysql')
var stringSimilarity = require('string-similarity')

var app = express()
var bodyParser = require('body-parser')
var cors = require('cors')
  
app.use(express.static(path.join(__dirname, 'public')))
  .use(cors())
  .use(bodyParser.json())
  .use(bodyParser.urlencoded({ extended: true }))
  .set('views', path.join(__dirname, 'views'))
  .set('view engine', 'ejs')
  .get('/', (req, res) => res.render('pages/index'))
  .listen(PORT, () => console.log(`Listening on ${ PORT }`))

app.get('/hello', (req, res) => res.json({hello: "world"}))

const multer = require('multer')

const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, 'public/uploads')
  },
  filename: function(req, file, cb) {
    cb(null, file.originalname)
  }
})

const upload = multer({
  storage: storage
})

const csvConverter = require('csv2json')
// const xlsConverter = require('xls2json')
const xlsConverter = require('xls-to-json')
const xlsxConverter = require('xlsx2json')

const onlyConvertXLSX = async (req, res) => {

  let fs = require('fs')

  var filename = req.file.filename
  var separator = req.body.separator

  xlsxConverter('./public/uploads/' + filename).then((jsonArray) => {
    
    var table_array = []
    for (var jsonObject of jsonArray[0]) {
      var row_array = []
      for (var [key, item] of Object.entries(jsonObject)) {
        row_array.push(item)
      }
      table_array.push(row_array)
    }

    res.send({status: true, data: table_array})
  });
}

const fetchXLSXdata = async (req, res) => {

  let fs = require('fs')

  var filename = req.file.filename
  var separator = req.body.separator

  xlsxConverter('./public/uploads/' + filename).then((jsonArray) => {
    
    var table_array = []
    for (var jsonObject of jsonArray[0]) {
      var row_array = []
      for (var [key, item] of Object.entries(jsonObject)) {
        row_array.push(item)
      }
      table_array.push(row_array)
    }

    // for (var row of table_array) {
    //   row.splice(7, 1)
    //   row.splice(12, 1)
    // }

    // for (var row of table_array) {
    //   row.splice(24, 18)
    //   row.splice(24, 0, table_array.indexOf(row)-5)
    //   row.splice(24, 0, table_array.indexOf(row)-5)
    //   row.splice(24, 0, table_array.indexOf(row)-5)
    //   // table_array[table_array.indexOf(row)] = 
    // }
    // for (var row of table_array) {
    //   table_array[table_array.indexOf(row)] = row.slice(24, 30)
    // }
    // for (var row of table_array) {
    //   table_array[table_array.indexOf(row)] = row.slice(30, 36)
    // }
    // for (var row of table_array) {
    //   table_array[table_array.indexOf(row)] = row.slice(36, 42)
    // }


    res.send({status: true, data: table_array})
  });
}

const onlyConvertXLS = async (req, res) => {

  let fs = require('fs')

  var filename = req.file.filename
  var separator = req.body.separator

  console.log(filename)

  xlsConverter({
    input: './public/uploads/' + filename,
    output: './public/uploads/' + filename + '.json'
  }, function(err, result) {
    if (err) {
      console.error(err)
    } else {
      console.log(result)
      res.send(result)
    }
  })
  
  // xlsConverter.convertFile('./public/uploads/' + filename, './public/uploads/' + filename + '.json', function (err, data) {
  //   if (err) {
  //     // there was an error
  //   } else {
  //     // it's all good
  //     console.log(data)
  //     res.send(data)
  //   }
  // });
}

const onlyConvertCSV = async (req, res) => {

  let fs = require('fs')

  var filename = req.file.filename
  var separator = req.body.separator

  var stream = fs.createReadStream('./public/uploads/' + filename)
    .pipe(csvConverter({
      separator: separator
    }))
    .pipe(fs.createWriteStream('./public/uploads/' + filename + '.json'))

  stream.on('finish', function () {

    var readstream = fs.createReadStream('./public/uploads/' + filename + '.json')
    var sent_data = ''
    readstream.on('data', (chunk) => {
      var read_data = chunk
      sent_data += read_data
    })

    readstream.on('end', async () => {
      var converted_data = JSON.parse(sent_data)

      res.send({
        status: true,
        data: converted_data
      })
    })
  })
}

const convertCSVAPI = async (req, res) => {

  var fs = require('fs')

  var filename = req.file.filename
  var hostname = req.headers.host

  var stream = fs.createReadStream('./public/uploads/' + filename)
    .pipe(csvConverter({
      separator: ';'
    }))
    .pipe(fs.createWriteStream('./public/uploads/' + filename + '.json'))

  stream.on('finish', function() {

    var readstream = fs.createReadStream('./public/uploads/' + filename + '.json')
    var sent_data = ''
    readstream.on('data', (chunk) => {
      var read_data = chunk
      sent_data += read_data
    })
  
    readstream.on('end', async () => {
      var converted_data = JSON.parse(sent_data)

      // save data
      var connection_string = 'mongodb://127.0.0.1/linkeddata'
      var db = await MongoClient.connect(connection_string)
      var collection = db.db('linkeddata').collection('data')

      var insert_status = await collection.insert(converted_data)
      
      // get inserted ids
      var inserted_links = []
      for (let i = 0; i < insert_status['insertedCount']; i++) {
        // generate URIs
        inserted_links.push(`http://${hostname}/dataset/linked_data/${insert_status['insertedIds']['' + i]}`)
      }

      // add context (data vocab)
      
      // send response, convert data done.
      the_response = {
        data: inserted_links
      }
      res.send(the_response)
    })

  })

  
  
}

var to = (promise) => {
  return promise.then((data) => {
    return [null, data];
  })
  .catch((err) => [err])
}

app.post('/convert/*', upload.single('data'), (req, res) => {
  console.log(req.url)

  switch (req.url) {
    case '/convert/csv':
      convertCSVAPI(req, res).then(function(result) {
        console.log('convert CSV done')
        // res.send(result)
      })
      break;
    case '/convert/web/csv':
      onlyConvertCSV(req, res).then(function(result) {
        console.log('convert CSV for web done')
      })
      break;
    case '/convert/web/xlsx':
      onlyConvertXLSX(req, res).then(function(result) {
        console.log('convert XLSX for web done')
      })
      break;
    case '/convert/web/xls':
      onlyConvertXLS(req, res).then(function(result) {
        console.log('convert XLS for web done')
      })
      break;
    case '/convert/web/xlsx/view':
      fetchXLSXdata(req, res).then(function(result) {
        console.log('Fetch data inside XLSX file to web done')
      })
      break;
    default:
      res.send('conversion not happenning')
      break;
  }

})

var handleGetData = async (req, res) => {
  var id_entity = req.params.id_entity

  var connection_string = 'mongodb://127.0.0.1/linkeddata'
  var db = await MongoClient.connect(connection_string)
  var collection = db.db('linkeddata').collection('data')

  var err
  var fetch_result = {}
  [err, fetch_result] = await collection.findOne({ _id: new mongo.ObjectID(id_entity) }) === null 
    ? {} 
    : await collection.findOne({ _id: new mongo.ObjectID(id_entity) })

  if (err) {
    res.send({error: err})
  }
  res.send(fetch_result)
}

app.get('/dataset/linked_data/:id_entity', (req, res) => 
  handleGetData(req, res).then(function() {
    console.log('done')
  })
)

var handleLinkingData = async (req, res) => {

  var body = req.body
  var hostname = req.headers.host

  console.log(req.body)

  var subj = body['subj']
  var obj = body['obj']
  var pred_dest = {}
  pred_dest[body['pred']] = `http://${hostname}/dataset/linked_data/${obj}`
  var pred_src = {}
  pred_src[body['pred']] = `http://${hostname}/dataset/linked_data/${subj}`

  var connection_string = 'mongodb://127.0.0.1/linkeddata'
  var db = await MongoClient.connect(connection_string)
  var collection = db.db('linkeddata').collection('data')

  var update_status_dest = await collection.update(
    { _id: new mongo.ObjectID(subj) },
    {
      '$set': pred_dest
    }
  )
  var update_status_src = await collection.update(
    { _id: new mongo.ObjectID(obj) },
    {
      '$set': pred_src
    }
  )

  console.log(update_status_dest)
  console.log(update_status_src)

  var new_data = []
  var dest_new_data = await collection.findOne({ _id: new mongo.ObjectID(subj) })
  var src_new_data = await collection.findOne({ _id: new mongo.ObjectID(obj) })
  new_data.push(dest_new_data)
  new_data.push(src_new_data)

  res.send(new_data)
}

app.post('/linking', (req, res) => {
  
  handleLinkingData(req, res).then(function() {
    console.log('done')
  })
})

app.get('/test', (req, res) => {

  res.send({
    hostname: req.headers.host
  })
})

var storeRDF = async (triples) => {

  var inserted = "INSERT IN GRAPH <http://example.com/datasets/graph/> { " + triples + " } "

  console.log('=== inserted ===')
  console.log(inserted)
  console.log('=== inserted ===')

  var header = {
    'Content-Type': 'application/sparql-query',
    'Content-Length': Buffer.byteLength(inserted)
  }
  console.log(' t 1')

  var request_options = {
    host: 'localhost',
    port: 8890,
    auth: 'dba:dba',
    path: '/DAV/home/dba/rdf_sink/mydata',
    method: 'POST',
    headers: header
  }

  let http = require('http')

  try {
    
    var do_request = function(the_request_options) {
      return new Promise ((resolve, reject) => {
        var response_data = ''
        var is_data_received = false
        var data_received = function(val) {
          is_data_received = val
        }
        
        let req = http.request(the_request_options, function(res) {
          res.setEncoding('utf-8')

          res.on('data', function(data) {
            response_data += data
          })
          
          res.on('end', function() {
            data_received(true)
            resolve(response_data)
            console.log('done')
          })
        })
        
        req.on('error', function(e) {
          console.log('Error request : ' + e)
          reject(e)
        })
        
        req.write(inserted)
        req.end()
      })
    }

    var the_response = await do_request(request_options)

    return {
      status: true,
      data: the_response
    }

  } catch (e) {
    console.log(e)
    console.log('====== error ====')
    return {
      status: false,
      err: e
    }
  }


}

app.post('/data/rdf', async (req, res) => {

  try {
    
    let rdf = ''
    for (let data of JSON.parse(req.body.data)) {
      data = await jsonld.expand(data)
      data[0]['@id'] = 'http://example.com/dataset' + data[0]['@id']
      rdf += await jsonld.toRDF(data, {format: 'application/n-quads'})
    }

    console.log(await jsonld.fromRDF(rdf, {format: 'application/n-quads'}))

    console.log('==== storeRDF(rdf) ====')
    console.log(await storeRDF(rdf))
    console.log('==== storeRDF(rdf) ====')

    res.send({
      status: true,
      data: rdf
    })
  } catch (e) {
    res.send({
      status: true,
      err: e
    })
  }

})


///////////////////////////////////////
///// RDF Subject Page + Web API //////
///////////////////////////////////////
var rdf = require('rdf')
const {Client} = require('virtuoso-sparql-client')

var CONTEXT = {
  // nama: "http://schema.org/name",
  // alamat: "http://schema.org/address",
  // gaji: "http://schema.org/baseSalary"
}

app.get('/sparql', async function(req, res) {
  if (_.isEmpty(req.query)) {

    res.render('pages/sparql')
  } else {

    console.log(req.query)
    var format = req.query.format

    let http = require('http')

    var do_request_sparql = function (url) {
      return new Promise((resolve, reject) => {
        var response_data = ''
        var is_data_received = false
        var data_received = function (val) {
          is_data_received = val
        }

        let req = http.request(url, function (res) {
          res.setEncoding('utf-8')

          res.on('data', function (data) {
            response_data += data
          })

          res.on('end', function () {
            data_received(true)
            // console.log()
            resolve(response_data)
            console.log('done')
            console.log(response_data)
          })
        })

        req.on('error', function (e) {
          console.log('Error request : ' + e)
          reject(e)
        })

        // req.write(inserted)
        req.end()
      })
    }

    var response = await do_request_sparql( `http://localhost:8890${req.url}`)
    if (format == 'text/html') {
      res.set('Content-Type', 'text/html')
      res.send(new Buffer(response))

    } else if (format == 'text/csv') {
      var csv = response

      res.setHeader('Content-disposition', 'attachment; filename=result.csv');
      res.set('Content-Type', 'text/csv');
      res.status(200).send(csv);
    }
    
    // res.redirect(`http://localhost:8890${req.url}`)
  }
})

app.get('/get/mysql', function(req, res) {

  var reqBody = req.query

  var con = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "information_schema"
  })

  var contents = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: `${reqBody['db_name']}`
  })

  var table_uris = {}
  var table_columns = {}
  var table_ranges = {}
  var table_contents = {}

  var conversion_context = {}

  var print_all = function() {
    console.log('console.log(table_uris)')
    console.log(table_uris)
    console.log('console.log(table_uris)')
    console.log('console.log(table_columns)')
    console.log(table_columns)
    console.log('console.log(table_columns)')
    console.log('console.log(table_ranges)')
    console.log(table_ranges)
    console.log('console.log(table_ranges)')
  }

  var save_to_context_var = function() {
    for (var [k, table_column] of Object.entries(table_columns)) {
      for (var [column_name, column_uri] of Object.entries(table_column)) {
        if (column_uri != '@id') {
          conversion_context[column_name] = [column_uri]
        } else {
          conversion_context[column_name] = ['@id']
        }
      }
    }

    console.log("==== conversion_context ===")
    console.log(conversion_context)
    console.log("==== conversion_context ===")

    //TODO: Tambah algoritma untuk identifikasi URI vocab terkait dengan kolom


  }

  var fetchColumns = new Promise(function (resolve, reject) {
    con.connect(function (err) {
      if (err) {
        res.status(500).send('Error: ' + err);
        return
      }

      // var getTablesCallback = function(err, results, fields) {
      //   for (var table of results) {
      //     table_uris[table['TABLE_NAME']] = 'http://example.com/datatype/' + table['TABLE_NAME']
      //   }

      //   console.log(table_uris)
      // }

      con.query(`SELECT TABLE_NAME
        FROM INFORMATION_SCHEMA.TABLES
        WHERE
          TABLE_SCHEMA = '${reqBody['db_name']}'`, function (err, db_result, fields) {
          for (var table of db_result) {
            table_uris[table['TABLE_NAME']] = `http://${req.headers.host}/dataset/${table['TABLE_NAME']}`
            table_columns[table['TABLE_NAME']] = {}
            table_ranges[table['TABLE_NAME']] = {}
          }

          console.log(table_uris)

          var columns_counter = 0
          for (var table of db_result) {

            con.query(`SELECT COLUMN_NAME, TABLE_NAME 
              FROM information_schema.columns 
              WHERE table_schema='${reqBody['db_name']}' 
                AND table_name='${table['TABLE_NAME']}'`, function (err, column_result, fields) {
                  if (err) {
                    res.status(500).send('Error: ' + err);
                    return
                  }
                  
                  for (var column of column_result) {
                    table_columns[column['TABLE_NAME']][column['COLUMN_NAME']] = `http://${req.headers.host}/ontology/${column['COLUMN_NAME']}`
                    table_ranges[column['TABLE_NAME']][column['COLUMN_NAME']] = ''
                  }
                  columns_counter++

                  if (columns_counter == db_result.length) {

                    columns_counter = 0
                    for (var table_foreign of db_result) {
                      con.query(`SELECT TABLE_NAME,COLUMN_NAME,CONSTRAINT_NAME, REFERENCED_TABLE_NAME,REFERENCED_COLUMN_NAME
                        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
                        WHERE
                          TABLE_SCHEMA = '${reqBody['db_name']}' AND
                          TABLE_NAME = '${table_foreign['TABLE_NAME']}'`, function(err, foreign_result, fields) {
                        
                        for (var foreign_column of foreign_result) {
                          if (foreign_column['REFERENCED_COLUMN_NAME'] == null) { // primary key
                            table_columns[foreign_column['TABLE_NAME']][foreign_column['COLUMN_NAME']] = '@id'
                            table_ranges[foreign_column['TABLE_NAME']][foreign_column['COLUMN_NAME']] = ''
                          } else {
                            table_ranges[foreign_column['TABLE_NAME']][foreign_column['COLUMN_NAME']] = table_uris[foreign_column['REFERENCED_TABLE_NAME']]
                          }
                        }

                        columns_counter++
                        if (columns_counter == db_result.length) {
                          // con.query(``, function(err, rows_result, fields) {
                          print_all()
                          save_to_context_var()
                          // res.send('asdf')
                          con.destroy()
                          resolve(conversion_context)
                          // })
                        }
                      }) // end of fetch related columns in every table
                    }
                  }
              }) // end of fetch columns in a table query
          } // end of for-loop table

        })


    }) // end of column iteration
  })

  var fetchRows = new Promise(function(resolve, reject) {
    contents.connect(function (err) {
      if (err) {
        // res.status(500).send('Error: ' + err);
        reject('Error: ' + err)
      }

      con.query(`SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = '${reqBody['db_name']}'`, function(err, table_result, table_fields) {
        if (err) {
          reject('Error: ' + err)
        }
        var table_iterated = 0
        // console.log('table_result ======')
        // console.log(table_result)
        // console.log('table_result ======')
        for (var table of table_result) {
          // console.log('table =========')
          // console.log(table)
          contents.query(`SELECT * FROM ${table['TABLE_NAME']}`, function(err, rows, row_fields) {
            // console.log(table)
            table_contents[table_result[table_iterated]['TABLE_NAME']] = rows
            table_iterated++
            // console.log(table_contents)
            if (table_iterated == table_result.length) {
              resolve(table_contents)
            }
          })
        }
      })
    })
  })

  var rdfStorer =  async function (data) {

    try {

      for (let [table_name, table_contents] of Object.entries(data)) {
        // let rdf = ''
        console.log('tablecontents')
        // data[0]['@id'] = 'http://example.com/dataset' + data[0]['@id']
        // console.log(table)
        for (var data_point of table_contents) {
          let rdf = ''
          console.log('datapoints')
          // console.log('data_point =====')
          // console.log(data_point)
          data_point = await jsonld.expand(data_point)
          
          rdf += await jsonld.toRDF(data_point, { format: 'application/n-quads' })
          console.log(await jsonld.fromRDF(rdf, { format: 'application/n-quads' }))
          console.log('==== storeRDF(rdf) ====')
          console.log(await storeRDF(rdf))
          console.log('==== storeRDF(rdf) ====')
        }
      }



      // console.log(rdf)
      // res.send({
      //   status: true,
      //   data: rdf
      // })
    } catch (e) {
      console.log(e)
      // res.send({
      //   status: true,
      //   err: e
      // })
    }

  }

  var resulted_jsonld = {}
  
  fetchColumns.then(function(result) {
    console.log('done fetchColumns - Result:')
    // console.log(result)

    fetchRows.then(function(table_result) {
      console.log('done fetchRows - Result:')
      console.log(table_result)
      
      console.log('done aweu - Result:')
      // console.log(table_columns)
      for (var [table_name, table_column] of Object.entries(table_columns)) {
        var iterated_table = table_result[table_name]
        // console.log(table_name)
        // console.log('table_column =======')
        // console.log(table_column)
        // console.log('iterated_table ======')
        // console.log(iterated_table)
        resulted_jsonld[table_name] = []

        for (var row of iterated_table) {
          for (var col in table_column) {
            if (table_column[col] == '@id') {
              row[col] = `http://${req.headers.host}/dataset/${table_name}_${row[col]}`
              break
            }
          }


          for (var range in table_ranges[table_name]) {
            if (table_ranges[table_name][range] !== '') {
              row[range] = `${table_ranges[table_name][range]}_${row[range]}`
              if (table_column[range] instanceof Object) {
                continue
              }
              var temp = {
                '@type': '@id',
                '@id': table_column[range]
              }
              console.log('temp ===========')
              console.log(temp)
              table_column[range] = temp
            }
          }

          row['@context'] = table_column
          resulted_jsonld[table_name].push(row)
        }
      }

      // console.log(resulted_jsonld)
      // res.send(resulted_jsonld); return;

      rdfStorer(resulted_jsonld).then(function() {
        
        res.send(resulted_jsonld)
      })
      .catch(function(err) {
        res.send('error: ' + err)
      })

    })
    .catch(function(err) {
      res.send('error: ' + err)
    })
  })

})

/////////////////////////
var convertOneDatabase = (req, res, databaseName) => new Promise((resolve, reject) => {
  var reqBody = req.query

  var con = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "information_schema"
  })

  var contents = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: `${databaseName}`
  })

  var table_uris = {}
  var table_columns = {}
  var table_ranges = {}
  var table_contents = {}

  var conversion_context = {}

  var print_all = function () {
    console.log('console.log(table_uris)')
    console.log(table_uris)
    console.log('console.log(table_uris)')
    console.log('console.log(table_columns)')
    console.log(table_columns)
    console.log('console.log(table_columns)')
    console.log('console.log(table_ranges)')
    console.log(table_ranges)
    console.log('console.log(table_ranges)')
  }

  var save_to_context_var = function () {
    for (var [k, table_column] of Object.entries(table_columns)) {
      for (var [column_name, column_uri] of Object.entries(table_column)) {
        if (column_uri != '@id') {
          conversion_context[column_name] = [column_uri]
        } else {
          conversion_context[column_name] = ['@id']
        }
      }
    }

    console.log("==== conversion_context ===")
    console.log(conversion_context)
    console.log("==== conversion_context ===")

    //TODO: Tambah algoritma untuk identifikasi URI vocab terkait dengan kolom


  }

  var fetchColumns = new Promise(function (resolve, reject) {
    con.connect(function (err) {
      if (err) {
        res.status(500).send('Error: ' + err);
        return
      }

      // var getTablesCallback = function(err, results, fields) {
      //   for (var table of results) {
      //     table_uris[table['TABLE_NAME']] = 'http://example.com/datatype/' + table['TABLE_NAME']
      //   }

      //   console.log(table_uris)
      // }

      con.query(`SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE
        TABLE_SCHEMA = '${databaseName}'`, function (err, db_result, fields) {
          for (var table of db_result) {
            table_uris[table['TABLE_NAME']] = `http://${req.headers.host}/dataset/${table['TABLE_NAME']}`
            table_columns[table['TABLE_NAME']] = {}
            table_ranges[table['TABLE_NAME']] = {}
          }

          console.log(table_uris)

          var columns_counter = 0
          for (var table of db_result) {

            con.query(`SELECT COLUMN_NAME, TABLE_NAME 
            FROM information_schema.columns 
            WHERE table_schema='${databaseName}' 
              AND table_name='${table['TABLE_NAME']}'`, function (err, column_result, fields) {
                if (err) {
                  res.status(500).send('Error: ' + err);
                  return
                }

                for (var column of column_result) {
                  table_columns[column['TABLE_NAME']][column['COLUMN_NAME']] = `http://${req.headers.host}/ontology/${column['COLUMN_NAME']}`
                  table_ranges[column['TABLE_NAME']][column['COLUMN_NAME']] = ''
                }
                columns_counter++

                if (columns_counter == db_result.length) {

                  columns_counter = 0
                  for (var table_foreign of db_result) {
                    con.query(`SELECT TABLE_NAME,COLUMN_NAME,CONSTRAINT_NAME, REFERENCED_TABLE_NAME,REFERENCED_COLUMN_NAME
                      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
                      WHERE
                        TABLE_SCHEMA = '${databaseName}' AND
                        TABLE_NAME = '${table_foreign['TABLE_NAME']}'`, function (err, foreign_result, fields) {

                        for (var foreign_column of foreign_result) {
                          if (foreign_column['REFERENCED_COLUMN_NAME'] == null) { // primary key
                            table_columns[foreign_column['TABLE_NAME']][foreign_column['COLUMN_NAME']] = '@id'
                            table_ranges[foreign_column['TABLE_NAME']][foreign_column['COLUMN_NAME']] = ''
                          } else {
                            table_ranges[foreign_column['TABLE_NAME']][foreign_column['COLUMN_NAME']] = table_uris[foreign_column['REFERENCED_TABLE_NAME']]
                          }
                        }

                        columns_counter++
                        if (columns_counter == db_result.length) {
                          // con.query(``, function(err, rows_result, fields) {
                          print_all()
                          save_to_context_var()
                          // res.send('asdf')
                          con.destroy()
                          resolve(conversion_context)
                          // })
                        }
                      }) // end of fetch related columns in every table
                  }
                }
              }) // end of fetch columns in a table query
          } // end of for-loop table

        })


    }) // end of column iteration
  })

  var fetchRows = new Promise(function (resolve, reject) {
    contents.connect(function (err) {
      if (err) {
        // res.status(500).send('Error: ' + err);
        reject('Error: ' + err)
      }

      con.query(`SELECT TABLE_NAME
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = '${databaseName}'`, function (err, table_result, table_fields) {
          if (err) {
            reject('Error: ' + err)
          }
          var table_iterated = 0
          // console.log('table_result ======')
          // console.log(table_result)
          // console.log('table_result ======')
          for (var table of table_result) {
            // console.log('table =========')
            // console.log(table)
            contents.query(`SELECT * FROM ${table['TABLE_NAME']}`, function (err, rows, row_fields) {
              // console.log(table)
              table_contents[table_result[table_iterated]['TABLE_NAME']] = rows
              table_iterated++
              // console.log(table_contents)
              if (table_iterated == table_result.length) {
                resolve(table_contents)
              }
            })
          }
        })
    })
  })

  var rdfStorer = async function (data) {

    try {

      for (let [table_name, table_contents] of Object.entries(data)) {
        // let rdf = ''
        console.log('tablecontents')
        // data[0]['@id'] = 'http://example.com/dataset' + data[0]['@id']
        // console.log(table)
        for (var data_point of table_contents) {
          let rdf = ''
          console.log('datapoints')
          // console.log('data_point =====')
          // console.log(data_point)
          data_point = await jsonld.expand(data_point)
          for (var [key, value] of Object.entries(data_point)) {
            let obj = {}
            obj['@context'] = CONTEXT
            obj[key] = value
            console.log('============== obj ==============')
            console.log(await jsonld.toRDF(obj, {format: 'application/n-quads'}))
            console.log('============== obj ==============')
          }
          
          
          console.log('============== rdf ==============')
          rdf += await jsonld.toRDF(data_point, { format: 'application/n-quads' })
          console.log(await jsonld.fromRDF(rdf, { format: 'application/n-quads' }))
          console.log('==== storeRDF(rdf) ====')
          console.log(await storeRDF(rdf))
          console.log('==== storeRDF(rdf) ====')
          console.log('============== rdf ==============')
        }
      }



      // console.log(rdf)
      // res.send({
      //   status: true,
      //   data: rdf
      // })
    } catch (e) {
      console.log(e)
      // res.send({
      //   status: true,
      //   err: e
      // })
    }

  }

  var resulted_jsonld = {}

  fetchColumns.then(function (result) {
    console.log('done fetchColumns - Result:')
    console.log(result)

    fetchRows.then(function (table_result) {
      console.log('done fetchRows - Result:')
      console.log(table_result)

      console.log('done aweu - Result:')
      // console.log(table_columns)
      for (var [table_name, table_column] of Object.entries(table_columns)) {
        var iterated_table = table_result[table_name]
        // console.log(table_name)
        // console.log('table_column =======')
        // console.log(table_column)
        // console.log('iterated_table ======')
        // console.log(iterated_table)
        resulted_jsonld[table_name] = []

        for (var row of iterated_table) {
          for (var col in table_column) {
            if (table_column[col] == '@id') {
              row[col] = `http://${req.headers.host}/dataset/${table_name}_${row[col]}`
              break
            }
          }


          for (var range in table_ranges[table_name]) {
            if (table_ranges[table_name][range] !== '') {
              row[range] = `${table_ranges[table_name][range]}_${row[range]}`
              if (table_column[range] instanceof Object) {
                continue
              }
              var temp = {
                '@type': '@id',
                '@id': table_column[range]
              }
              console.log('temp ===========')
              console.log(temp)
              table_column[range] = temp
            }
          }

          row['@context'] = table_column
          resulted_jsonld[table_name].push(row)
        }
      }

      // console.log(resulted_jsonld)
      // res.send(resulted_jsonld); return;


      
      resolve(resulted_jsonld)

      // rdfStorer(resulted_jsonld).then(function () {

      //   // res.send(resulted_jsonld)
      //   resolve(resulted_jsonld)
      // })
      // .catch(function (err) {
      //   reject('error: ' + err)
      // })


    })
      .catch(function (err) {
        reject('error: ' + err)
      })
  })
})

////////////////////////////////////////////////////
app.post('/get/relational', async function (req, res) {

  var reqBody = req.body
  var database_names = reqBody['db_name'].split(',')
  var checked_attributes = reqBody['primary_keys'].split(',')
  var results = {}
  for (var database_name of database_names) {
    console.log(await convertOneDatabase(req, res, database_name))
    console.log('=========================')
    results[database_name] = await convertOneDatabase(req, res, database_name)
  }

  console.log('done')

  var global_cleaned_array = []
  var global_merged_array = []

  for (var [key_1, val_1] of Object.entries(results)) {
    for (var [key_2, val_2] of Object.entries(val_1)) {
      global_cleaned_array.push(val_2)
    }
  }

  console.log('======== global_cleaned_array')
  console.log(global_cleaned_array)
  console.log('======== global_cleaned_array')

  var scoreDatapointSimilarity = function (datapoint, row) {

    var current_score = 0
    // console.log(`${datapoint} - ${row}`)

    // console.log('======= ***** ========')
    // console.log(datapoint)
    // console.log('======= - - - ========')
    // console.log(row)
    // console.log('======= ***** ========')

    for (var [r_key, r_value] of Object.entries(row)) {
      if (r_value === "" || r_key === '@context') {
        continue
      }
      for (var [dp_key, dp_value] of Object.entries(datapoint)) {
        if (dp_value === "" || dp_key === '@context') {
          continue
        }
        var val_score = stringSimilarity.compareTwoStrings(r_value.toLowerCase(), dp_value.toLowerCase())
        // console.log(val_score)
        if (val_score >= 0.9 && checked_attributes.indexOf(r_key.toLowerCase()) > -1 && checked_attributes.length > 0) {
          // console.log(`${r_value} - ${dp_value}`)
          current_score++
        }
      }
    }

    return current_score
  }

  var searchSimilarDatapoint = function (merged_array, row) {

    var max_score = 0

    var dp_idx = -1

    for (var datapoint of global_merged_array) {
      var score = scoreDatapointSimilarity(datapoint, row)
      // console.log(max_score)
      if (score > max_score) {
        // console.log('====== datapoint ======')
        // console.log(score)
        // console.log(datapoint)
        // console.log('====== datapoint ======')
        dp_idx = global_merged_array.indexOf(datapoint)
        max_score = score
      }
      // if (score >= 0.8) {

      // }
    }
    console.log(dp_idx)

    if (dp_idx == -1) {
      console.log('push push')
      var newobj = {}
      for (var [k, v] of Object.entries(row['@context'])) {
        if (v != '@id') {
          newobj[k] = v
        }
      }
      CONTEXT = Object.assign(CONTEXT, newobj)
      global_merged_array.push(row)
      // console.log(global_merged_array)
    } else {
      // console.log(dp_idx)
      // global_merged_array = mergeObject(global_merged_array, row, dp_idx)
      mergeObject(global_merged_array, row, dp_idx)
    }

    // console.log(merged_array)

    // global_merged_array = merged_array
    // return merged_array
  }

  var mergeObject = function (merged_array, row, merged_idx) {

    var mergedObject = global_merged_array[merged_idx]
    console.log('========= ----- =========')
    console.log(mergedObject)
    console.log('========= **** =========')
    console.log(row)
    console.log('========= ----- =========')

    for (var [r_key, r_value] of Object.entries(row)) {
      for (var [dp_key, dp_value] of Object.entries(mergedObject)) {
        var key_score = stringSimilarity.compareTwoStrings(r_key.toLowerCase(), dp_key.toLowerCase())
        if (key_score >= 0.9 && (r_key !== '@context' && dp_key !== '@context')) {
          mergedObject[dp_key] = r_value
          // if (r_value !== '') {
          //   mergedObject[dp_key] = r_value
          // } else {
          //   mergedObject[dp_key] = dp_value
          // }

          // console.log('====== mergedObject[dp_key] ========')
          // console.log(dp_key)
          // console.log(mergedObject[dp_key])
          // console.log('====== mergedObject[dp_key] ========')
        } else if (r_key === '@context' && dp_key === '@context') {
          console.log('========== Object.assign() ==========')
          console.log(Object.assign(r_value, dp_value))
          console.log('========== Object.assign() ==========')
          CONTEXT = Object.assign(CONTEXT, r_value, dp_value)
          // mergedObject['@context'] = Object.assign(r_value, dp_value)
          mergedObject['@context'] = CONTEXT
        } else {
          // mergedObject
          mergedObject[r_key] = r_value
          // if (r_value !== '') {
          //   mergedObject[r_key] = r_value
          // } else {
          //   mergedObject[r_key] = dp_value
          // }

          // console.log('======= mergeObject[r_key] ========')
          // console.log(r_key)
          // console.log(mergedObject[r_key])
          // console.log('======= mergeObject[r_key] ========')
        }
      }
    }

    // console.log(mergedObject)
    global_merged_array[merged_idx] = mergedObject

    // return global_merged_array
  }

  var mergeResponse = function () {

    for (var table of global_cleaned_array) {

      if (global_cleaned_array.indexOf(table) == 0) {
        global_merged_array = global_merged_array.concat(table)
        // console.log(table)
        console.log(global_merged_array)
        continue
      }


      for (var row of table) {

        if (global_merged_array.length > 0) {

          searchSimilarDatapoint(global_merged_array, row)
          // console.log(global_merged_array)
        } else {
          global_merged_array.push(row)
        }

      }

    }


    var ontologyStorer = async function (data) {

      try {

        for (let [table_name, table_contents] of Object.entries(data)) {
          // let rdf = ''
          console.log('tablecontents')
          // data[0]['@id'] = 'http://example.com/dataset' + data[0]['@id']
          // console.log(table)
          for (var data_point of table_contents) {
            let rdf = ''
            console.log('datapoints')
            // console.log('data_point =====')
            // console.log(data_point)
            data_point = await jsonld.expand(data_point)

            rdf += await jsonld.toRDF(data_point, { format: 'application/n-quads' })
            console.log(await jsonld.fromRDF(rdf, { format: 'application/n-quads' }))
            console.log('==== storeRDF(rdf) ====')
            console.log(await storeRDF(rdf))
            console.log('==== storeRDF(rdf) ====')
          }
        }



        // console.log(rdf)
        // res.send({
        //   status: true,
        //   data: rdf
        // })
      } catch (e) {
        console.log(e)
        // res.send({
        //   status: true,
        //   err: e
        // })
      }

    }

    var baseContext = {
      'label': 'http://www.w3.org/2000/01/rdf-schema#label'
    }

    // CONTEXT['label'] = 'http://www.w3.org/2000/01/rdf-schema#label'

    var ontologies = []

    for (var [label, ontology_uri] of Object.entries(CONTEXT)) {

      var id_uri = ontology_uri
      if (typeof id_uri === 'object') {
        id_uri = id_uri['@id']
      }

      var ontology_object = {
        '@context': baseContext,
        '@id': id_uri,
        'label': label
      }

      ontologies.push(ontology_object)
    }

    // res.send({
    //   data: ontologies
    // })
    ontologyStorer({ data: ontologies }).then(function () {
      console.log('done save ontologies')
    }).catch(function (err) {
      res.send('error: ' + err)
    })

  }

  mergeResponse()

  console.log('======= global_merged_array =========')
  console.log(global_merged_array)
  console.log('======= global_merged_array =========')

  var sameColumns = reqBody['same_columns']

  for (var singleDataObject of global_merged_array) {

    var datakeys = {}

    for (var [dataObjectKey, dataObjectValue] of Object.entries(singleDataObject)) {
      if (dataObjectKey != '@context') {
        datakeys[dataObjectKey.toLowerCase()] = dataObjectKey
      }
    }

    for (var columnPair of sameColumns) {
      for (var columnElem of columnPair) {
        
        if (columnPair.indexOf(columnElem) > 0) {
          
          let keyOfData = datakeys[columnPair[0]]
          let keyOfOldData = datakeys[columnElem]

          if (keyOfData != keyOfOldData) {
            singleDataObject[keyOfOldData] = singleDataObject[keyOfData]
          }

        }

      }
    }

    // TODO: lanjutkan
  }

  var rdfStorer = async function (data) {

    try {

      // for (let [table_name, table_contents] of Object.entries(data)) {
        // let rdf = ''
        console.log('tablecontents')
        // data[0]['@id'] = 'http://example.com/dataset' + data[0]['@id']
        // console.log(table)
        for (var data_point of data) {
          let rdf = ''
          console.log('datapoints')
          // console.log('data_point =====')
          // console.log(data_point)
          data_point = await jsonld.expand(data_point)
          // for (var [key, value] of Object.entries(data_point)) {
          //   let obj = {}
          //   obj['@context'] = CONTEXT
          //   obj[key] = value
          //   console.log('============== obj ==============')
          //   console.log(await jsonld.toRDF(obj, { format: 'application/n-quads' }))
          //   console.log('============== obj ==============')
          // }


          console.log('============== rdf ==============')
          rdf += await jsonld.toRDF(data_point, { format: 'application/n-quads' })
          console.log(await jsonld.fromRDF(rdf, { format: 'application/n-quads' }))
          console.log('==== storeRDF(rdf) ====')
          console.log(await storeRDF(rdf))
          console.log('==== storeRDF(rdf) ====')
          console.log('============== rdf ==============')
        }
      // }



      // console.log(rdf)
      // res.send({
      //   status: true,
      //   data: rdf
      // })
    } catch (e) {
      console.log(e)
      // res.send({
      //   status: true,
      //   err: e
      // })
    }

  }

  rdfStorer(global_merged_array).then(function() {
    
    res.send({
      merged_array: global_merged_array,
      data: results
    })
  }).catch(function(err) {
    res.send({
      err: 'err : ' + err
    })
  })

})

app.post('/get/xlsx', upload.any(), async function(req, res) {

  let fs = require('fs')

  var filename = req.files[1].filename
  // console.log(req.file)
  // console.log(req.files)
  // var separator = req.body.separator
  var reqBody = req.body
  var checked_attributes = reqBody['primary_keys'].split(',')
  var sameColumns = JSON.parse(reqBody['same_columns'])

  console.log('======== sameColumns')
  console.log(sameColumns)
  console.log('======== sameColumns')

  var global_array = []
  var global_cleaned_array = []
  var global_merged_array = []
  var global_enhanced_array = []
  var iterated_files = req.files.length
  var count_called = 0


  var newRdfStorer = async function (data) {

    try {

      // for (let [table_name, table_contents] of Object.entries(data)) {
      // let rdf = ''
      console.log('tablecontents')
      // data[0]['@id'] = 'http://example.com/dataset' + data[0]['@id']
      // console.log(table)
      for (var data_point of data) {
        let rdf = ''
        console.log('datapoints')
        data_point = await jsonld.expand(data_point)
        console.log('data_point =====')
        console.log(data_point)
        // for (var [key, value] of Object.entries(data_point)) {
        //   let obj = {}
        //   obj['@context'] = CONTEXT
        //   obj[key] = value
        //   console.log('============== obj ==============')
        //   console.log(await jsonld.toRDF(obj, { format: 'application/n-quads' }))
        //   console.log('============== obj ==============')
        // }


        console.log('============== rdf ==============')
        rdf += await jsonld.toRDF(data_point, { format: 'application/n-quads' })
        console.log(await jsonld.fromRDF(rdf, { format: 'application/n-quads' }))
        console.log('==== storeRDF(rdf) ====')
        console.log(await storeRDF(rdf))
        console.log('==== storeRDF(rdf) ====')
        console.log('============== rdf ==============')
      }
      // }



      // console.log(rdf)
      // res.send({
      //   status: true,
      //   data: rdf
      // })
    } catch (e) {
      console.log(e)
      // res.send({
      //   status: true,
      //   err: e
      // })
    }

  }

  var sendResponse = function(inserted_array) {
    global_array[count_called] = inserted_array
    count_called++
    if (count_called < iterated_files) {
      return
    }
    processResponse()
    console.log('====== global_cleaned_array')
    console.log(global_cleaned_array)
    console.log('====== global_cleaned_array')
    mergeResponse()
    console.log('adding context')
    addContextToObject()
    
    mergeColumns()
    
    //TODO: add detect grouping
    entityGrouping()
    console.log('====== global_enhanced_array')
    console.log(global_enhanced_array)
    console.log('====== global_enhanced_array')

    newRdfStorer(global_enhanced_array).then(function() {

      console.log('done')
      console.log(global_merged_array.length)

      console.log('================ file object')
      console.log(fileObjects)
      console.log('================ file object')
  
      res.send({ enhanced: global_enhanced_array, status: true, data: global_merged_array })
    })
  }

  var entityGrouping = function() {
    var entities = JSON.parse(reqBody['entities'])

    if (entities.length == 0) {
      return
    }

    // else
    for (var entity of entities) {

      if (!reqBody[entity]) {
        return
      }

      if (!JSON.parse(reqBody[entity])) {
        return
      }

      var entityProps = JSON.parse(reqBody[entity])

      for (var dataObject of global_merged_array) {
        var dataObjectIdx = global_merged_array.indexOf(dataObject)

        
        var newObject = {}
        var idProp = ''
        var idVal = ''

        var pairAlias = []

        var linkedPropsURI = []
        var linkedProps = []
        var linkedVals = []

        for (var [dataObjectKey, dataObjectValue] of Object.entries(dataObject)) {
          
          if (dataObjectKey == '@context') {

            for (var [_key, _val] of Object.entries(dataObjectValue)) {
              if (_val == '@id') {
                delete dataObjectValue[_key]
              }
            }


            newObject['@context'] = dataObjectValue
            continue
          }
          

          for (var prop of entityProps) {
            if (typeof prop === 'object') {
              if (Array.isArray(prop)) {

                if (dataObjectKey.toLowerCase() == prop[0]) {
                  newObject[prop[1]] = dataObjectValue
                  pairAlias.push([dataObjectKey, prop[1]])

                  if (entityProps.indexOf(prop) == 0) {
                    idProp = prop[1]
                    idVal = `http://${req.headers.host}/dataset/data_${entity}_${dataObjectValue}`
                  }
                }

                continue
              }

              if (Object.entries(prop)[0][1] == dataObjectKey.toLowerCase()) {

                // if (entityProps.indexOf(prop) == 0) {
                //   idProp = dataObjectKey
                //   idVal = `http://${req.headers.host}/dataset/data_${(Object.entries(prop)[0][0]).toLowerCase()}_${dataObject[Object.entries(prop)[0][1]]}`
                // }
                linkedProps.push(Object.entries(prop)[0][0])
                linkedPropsURI.push({'@type': '@id', '@id': `http://${req.headers.host}/ontology/${Object.entries(prop)[0][0]}`})
                
                newObject[Object.entries(prop)[0][0]] = `http://${req.headers.host}/dataset/data_${(Object.entries(prop)[0][0]).toLowerCase()}_${dataObjectValue}`
                
                linkedVals.push(`http://${req.headers.host}/dataset/data_${(Object.entries(prop)[0][0]).toLowerCase()}_${dataObjectValue}`)

                CONTEXT[Object.entries(prop)[0][0]] = {'@type': '@id', '@id': `http://${req.headers.host}/ontology/${Object.entries(prop)[0][0]}`}
              }

              continue
            }

            if (dataObjectKey.toLowerCase() == prop) {
              newObject[dataObjectKey] = dataObjectValue
              if (entityProps.indexOf(prop) == 0) {
                idProp = dataObjectKey
                // newObject['@context'][dataObjectKey] = '@id'
                idVal = `http://${req.headers.host}/dataset/data_${entity}_${dataObjectValue}`
              }

            }
          }
          
        }

        if (idProp != '') {
          newObject['@context'][idProp] = '@id'
          newObject[idProp] = idVal
        }

        if (linkedProps.length > 0) {
          for (var eachProp of linkedProps) {
            var curr_idx = linkedProps.indexOf(eachProp)

            newObject['@context'][eachProp] = linkedPropsURI[curr_idx]
          }
        }

        global_enhanced_array.push(newObject)

      }
    }
  }

  var mergeColumns = function () {

    var sameColumns = JSON.parse(reqBody['same_columns'])

    for (var singleDataObject of global_merged_array) {

      var datakeys = {}

      for (var [dataObjectKey, dataObjectValue] of Object.entries(singleDataObject)) {
        if (dataObjectKey != '@context') {
          datakeys[dataObjectKey.toLowerCase()] = dataObjectKey
        }
      }

      for (var columnPair of sameColumns) {
        for (var columnElem of columnPair) {

          if (columnPair.indexOf(columnElem) > 0) {

            let keyOfData = datakeys[columnPair[0]]
            let keyOfOldData = datakeys[columnElem]

            if (keyOfData != keyOfOldData) {
              singleDataObject[keyOfOldData] = singleDataObject[keyOfData]
            }

          }

        }
      }

      // TODO: lanjutkan
    }

  }

  var rdfStorer = async function (data) {

    try {

      // for (let [table_name, table_contents] of Object.entries(data)) {
        // let rdf = ''
        console.log('tablecontents')
        // data[0]['@id'] = 'http://example.com/dataset' + data[0]['@id']
        // console.log(table)
        for (var data_point of global_merged_array) {
          let rdf = ''
          console.log('datapoints')
          // console.log('data_point =====')
          // console.log(data_point)
          data_point = await jsonld.expand(data_point)

          rdf += await jsonld.toRDF(data_point, { format: 'application/n-quads' })
          console.log(await jsonld.fromRDF(rdf, { format: 'application/n-quads' }))
          console.log('==== storeRDF(rdf) ====')
          console.log(await storeRDF(rdf))
          console.log('==== storeRDF(rdf) ====')
        }
      // }



      // console.log(rdf)
      // res.send({
      //   status: true,
      //   data: rdf
      // })
    } catch (e) {
      console.log(e)
      // res.send({
      //   status: true,
      //   err: e
      // })
    }

  }

  var addContextToObject = function() {

    var the_context = {}

    for (var data_item of global_merged_array) {
      for (var [item_key, item_value] of Object.entries(data_item)) {
        the_context[item_key] = `http://localhost:5000/ontology/${item_key}`
      }
    }

    console.log('======== context ===========')
    console.log(the_context)
    CONTEXT = the_context
    console.log('======== context ===========')

    var _id = 1
    for (var data_item of global_merged_array) {
      the_context['_id'] = '@id'
      data_item['_id'] = `http://${req.headers.host}/dataset/data_merged_${_id}`
      data_item['@context'] = the_context

      _id++
    }
  }

  

  var scoreDatapointSimilarity = function(datapoint, row) {

    var current_score = 0
    // console.log(`${datapoint} - ${row}`)

    // console.log('======= ***** ========')
    // console.log(datapoint)
    // console.log('======= - - - ========')
    // console.log(row)
    // console.log('======= ***** ========')

    for (var [r_key, r_value] of Object.entries(row)) {
      if (r_value === "") {
        continue
      }
      for (var [dp_key, dp_value] of Object.entries(datapoint)) {
        if (dp_value === "") {
          continue
        }
        var val_score = stringSimilarity.compareTwoStrings(r_value.toLowerCase(), dp_value.toLowerCase())
        // console.log(val_score)
        if (val_score >= 0.9 && checked_attributes.indexOf(r_key.toLowerCase()) > -1 && checked_attributes.length > 0) {
          // console.log(`${r_value} - ${dp_value}`)
          current_score++
        }
      }
    }

    return current_score
  }

  var searchSimilarDatapoint = function(merged_array, row) {
    
    var max_score = 0
    
    var dp_idx = -1
    
    for (var datapoint of global_merged_array) {
      var score = scoreDatapointSimilarity(datapoint, row)
      // console.log(max_score)
      if (score > max_score) {
        // console.log('====== datapoint ======')
        // console.log(score)
        // console.log(datapoint)
        // console.log('====== datapoint ======')
        dp_idx = global_merged_array.indexOf(datapoint)
        max_score = score
      }
      // if (score >= 0.8) {

      // }
    }
    console.log(dp_idx)

    if (dp_idx == -1) {
      console.log('push push')
      global_merged_array.push(row)
      // console.log(global_merged_array)
    } else {
      // console.log(dp_idx)
      // global_merged_array = mergeObject(global_merged_array, row, dp_idx)
      mergeObject(global_merged_array, row, dp_idx)
    }

    // console.log(merged_array)

    // global_merged_array = merged_array
    // return merged_array
  }

  var mergeObject = function(merged_array, row, merged_idx) {

    var mergedObject = global_merged_array[merged_idx]
    console.log('========= ----- =========')
    console.log(mergedObject)
    console.log('========= **** =========')
    console.log(row)
    console.log('========= ----- =========')

    for (var [r_key, r_value] of Object.entries(row)) {
      for (var [dp_key, dp_value] of Object.entries(mergedObject)) {
        var key_score = stringSimilarity.compareTwoStrings(r_key.toLowerCase(), dp_key.toLowerCase())
        if (key_score >= 0.9) {
          mergedObject[dp_key] = r_value
          // if (r_value !== '') {
          //   mergedObject[dp_key] = r_value
          // } else {
          //   mergedObject[dp_key] = dp_value
          // }

          // console.log('====== mergedObject[dp_key] ========')
          // console.log(dp_key)
          // console.log(mergedObject[dp_key])
          // console.log('====== mergedObject[dp_key] ========')
        } else {
          // mergedObject
          mergedObject[r_key] = r_value
          // if (r_value !== '') {
          //   mergedObject[r_key] = r_value
          // } else {
          //   mergedObject[r_key] = dp_value
          // }
          
          // console.log('======= mergeObject[r_key] ========')
          // console.log(r_key)
          // console.log(mergedObject[r_key])
          // console.log('======= mergeObject[r_key] ========')
        }
      }
    }

    // console.log(mergedObject)
    global_merged_array[merged_idx] = mergedObject

    // return global_merged_array
  }

  var mergeResponse = function() {

    for (var table of global_cleaned_array) {

      if (global_cleaned_array.indexOf(table) == 0) {
        global_merged_array = global_merged_array.concat(table)
        // console.log(table)
        console.log(global_merged_array)
        continue
      }


      for (var row of table) {

        if (global_merged_array.length > 0) {

          searchSimilarDatapoint(global_merged_array, row)
          // console.log(global_merged_array)
        } else {
          global_merged_array.push(row)
        }
        
      }

    }

  }

  var cleanMetadata = function(the_metadata) {

    for (var col of the_metadata) {
      var oldcol = col
      // col = col.replace(/[|&;$%@"<>()+,^\s]+/g, "");
      col = col.replace(/[^0-9a-zA-Z_]+/g, "");
      // col.replace(/[^0-9a-zA-Z-_]+/g, "");
      // col.replace(/ +/g, '')
      col = col.replace(/\s+/g, '')
      the_metadata[the_metadata.indexOf(oldcol)] = col
      // col = col.replace(' ', '')
    }

    // console.log(the_metadata)

    return the_metadata
  }

  var determineMetadata = function(table, current_metadata_idx) {

    var min_unempty_cells = 0

    // console.log(table)

    for (var cell of table[current_metadata_idx]) {
      if (cell !== '') {
        min_unempty_cells++
      }
    }

    // var row_idx = 0
    // console.log(table.length)
    for (var row of table) {
      var row_unempty_cells = 0
      for (var elem of row) {
        if (elem !== '') {
          row_unempty_cells++
        }
      }

      if (row_unempty_cells > min_unempty_cells) {
        current_metadata_idx = table.indexOf(row)
        min_unempty_cells = row_unempty_cells
        // console.log(row)
      }

      // row_idx++
    }

    // console.log(min_unempty_cells)
    return current_metadata_idx
  }

  var cleanDataset = function(table, metadata, cleanedMetadata) {

    // console.log(metadata)
    console.log(cleanedMetadata)
    console.log(table.indexOf(metadata))

    var start_idx = table.indexOf(metadata) + 1
    var max_col = table[start_idx].length

    var arr = []

    var isAllEmpty = function(row_elements) {

      var notEmptyCell = 0

      for (var cell of row_elements) {
        if (cell !== '') {
          notEmptyCell++
        }
      }

      if (notEmptyCell > 0) {
        return false
      } else {
        return true
      }
    }

    for (var i = start_idx; i < table.length; i++) {
      var current_obj = {}
      if (isAllEmpty(table[i])) {
        continue
      }
      for (var j = 0; j < max_col; j++) {
        if (metadata[j] !== '') {
          current_obj[cleanedMetadata[j]] = table[i][j]
        }
      }

      arr.push(current_obj)
    }

    global_cleaned_array.push(arr)

  }

  var metadatas = []

  var processResponse = function() {
    for (var table of global_array) {
      var metadata_idx = 0
      metadata_idx = determineMetadata(table, metadata_idx)
      // console.log(metadata_idx)
      // metadatas.push(metadata_idx)
      cleanedMetadata = cleanMetadata(table[metadata_idx])
      cleanDataset(table, table[metadata_idx], cleanedMetadata)
      for (var row of table) {
        // console.log(row)
      }
      console.log('===========')
    }

    

    // console.log(metadatas)
  }

  var fileObjects = []
  var priority_array = JSON.parse(reqBody['priority'])

  for (var fileobj of req.files) {

    // var stats = fs.statSync(fileobj.path);
    // var mtime = stats.birthtimeMs;
    
    var objfile = {}

    // console.log('======================================== iteration start')
    // console.log(fileobj.filename)
    // console.log(stats)
    // console.log('======================================== iteration end')

    var thename = fileobj.originalname

    fileObjects.push(Object.assign(objfile, fileobj, {priority: priority_array.indexOf(thename)}))

  }

  fileObjects.sort(function(a, b) {
    return a.priority - b.priority
  })

  for (var file of fileObjects) {
    console.log(file)

    var jsonArray = await xlsxConverter('./public/uploads/' + file.filename)
    // .then((jsonArray) => {
  
      var table_array = []
      for (var jsonObject of jsonArray[0]) {
        var row_array = []
        for (var [key, item] of Object.entries(jsonObject)) {
          row_array.push(item)
        }
        table_array.push(row_array)
      }  
  
      sendResponse(table_array)
      
    // });
  }

  console.log('====== checked_attributes')
  console.log(checked_attributes)
  console.log('====== checked_attributes')

  // res.send('asdf')

})

app.get('/save/ontology', function(req, res) {

  var ontologyStorer = async function (data) {

    try {

      for (let [table_name, table_contents] of Object.entries(data)) {
        // let rdf = ''
        console.log('tablecontents')
        // data[0]['@id'] = 'http://example.com/dataset' + data[0]['@id']
        // console.log(table)
        for (var data_point of table_contents) {
          let rdf = ''
          console.log('datapoints')
          // console.log('data_point =====')
          // console.log(data_point)
          data_point = await jsonld.expand(data_point)

          rdf += await jsonld.toRDF(data_point, { format: 'application/n-quads' })
          console.log(await jsonld.fromRDF(rdf, { format: 'application/n-quads' }))
          console.log('==== storeRDF(rdf) ====')
          console.log(await storeRDF(rdf))
          console.log('==== storeRDF(rdf) ====')
        }
      }



      // console.log(rdf)
      // res.send({
      //   status: true,
      //   data: rdf
      // })
    } catch (e) {
      console.log(e)
      // res.send({
      //   status: true,
      //   err: e
      // })
    }

  }

  var baseContext = {
    'label': 'http://www.w3.org/2000/01/rdf-schema#label'
  }

  CONTEXT['label'] = 'http://www.w3.org/2000/01/rdf-schema#label'

  var ontologies = []

  for (var [label, ontology_uri] of Object.entries(CONTEXT)) {

    var id_uri = ontology_uri
    if (typeof id_uri === 'object') {
      id_uri = id_uri['@id']
    }

    var ontology_object = {
      '@context': baseContext,
      '@id': id_uri,
      'label': label
    }

    ontologies.push(ontology_object)
  }
  
  // res.send({
  //   data: ontologies
  // })
  ontologyStorer({data: ontologies}).then(function() {
    
    res.send({
      data: ontologies
    })
  }).catch(function(err) {
    res.send('error: ' + err)
  })


})

app.get('/dataset/*', function (req, res) {

  var received_url = `http://${req.headers.host}${req.url}`
  // var received_url = `http://${req.header}${req.url}`
  const DbpediaClient = new Client('http://localhost:8890/sparql')

  if (req.headers['content-type'] === 'application/json') {
    console.log('appjson')

    DbpediaClient.query(`DESCRIBE <${received_url}> FROM <http://example.com/datasets/graph/>`)
      .then(async (subject_jsonld) => {

        if (_.isEmpty(subject_jsonld)) {
          res.send(subject_jsonld)
          return
        }
        const compacted = await jsonld.compact(subject_jsonld, CONTEXT)
        res.send(compacted)
      })
      .catch((err) => {
        res.send(err)
      })
  } else {

    DbpediaClient.query(`DESCRIBE <${received_url}> FROM <http://example.com/datasets/graph/>`)
      .then(async (subject_jsonld) => {

        if (_.isEmpty(subject_jsonld)) {
          // send 404 page
          res.render('pages/404')
          // res.send(subject_jsonld)
          return
        }


        const compacted = await jsonld.compact(subject_jsonld, CONTEXT)
        var identifier = Object.keys(compacted['@context']).filter(function (key) { return compacted['@context'][key] === '@id' })
        // console.log('====== identifier ========')
        // console.log(identifier)
        // console.log('======= identifier ========')

        // send subject page with resource
        delete compacted['@context']


        // console.log(JSON.stringify(compacted))
        res.render('pages/rdfsubject', {
          'subj': compacted,
          'isgraph': compacted.hasOwnProperty('@graph'),
          'identifier': identifier,
          'context': CONTEXT,
        })
        // res.send(compacted)
      })
      .catch((err) => {
        res.send(err)
      })
  }


})

app.get('/ontology/*', function(req, res) {

  console.log(req.url)

  var received_url = `http://${req.headers.host}${req.url}`
  // var received_url = `http://${req.header}${req.url}`
  const DbpediaClient = new Client('http://localhost:8890/sparql')

  // if (req.headers['content-type'] === 'application/json') {
  //   console.log('appjson')

  //   DbpediaClient.query(`DESCRIBE <${received_url}> FROM <http://example.com/datasets/graph/>`)
  //     .then(async (subject_jsonld) => {

  //       if (_.isEmpty(subject_jsonld)) {
  //         res.send(subject_jsonld)
  //         return
  //       }
  //       const compacted = await jsonld.compact(subject_jsonld, CONTEXT)
  //       res.send(compacted)
  //     })
  //     .catch((err) => {
  //       res.send(err)
  //     })
  // } else {

    DbpediaClient.query(`DESCRIBE <${received_url}> FROM <http://example.com/datasets/graph/>`)
      .then(async (subject_jsonld) => {

        if (_.isEmpty(subject_jsonld)) {
          // send 404 page
          res.render('pages/404')
          // res.send(subject_jsonld)
          return
        }


        // const compacted = subject_jsonld
        const compacted = await jsonld.compact(subject_jsonld, { 'label': 'http://www.w3.org/2000/01/rdf-schema#label'})
        // var identifier = Object.keys(compacted['@context']).filter(function (key) { return compacted['@context'][key] === '@id' })
        
        // console.log('====== identifier ========')
        // console.log(identifier)
        // console.log('======= identifier ========')

        // send subject page with resource
        delete compacted['@context']


        console.log('========== compacted ============')
        console.log(compacted)
        console.log('========== compacted ============')
        // console.log(JSON.stringify(compacted))
        res.render('pages/ontology', {
          'ontology': compacted,
          'isgraph': compacted.hasOwnProperty('@graph'),
          // 'identifier': identifier,
          'context': CONTEXT,
        })
        // res.send(compacted)
      })
      .catch((err) => {
        res.send(err)
      })
  // }

})