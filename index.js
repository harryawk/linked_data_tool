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

const CONTEXT = {
  nama: "http://schema.org/name",
  alamat: "http://schema.org/address",
  gaji: "http://schema.org/baseSalary"
}

app.get('/dataset/*', function (req, res) {

  var received_url = `http://${req.headers.host}${req.url}`
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
        // send subject page with resource
        delete compacted['@context']
        // console.log(JSON.stringify(compacted))
        res.render('pages/rdfsubject', {
          'subj': compacted,
          'isgraph': compacted.hasOwnProperty('@graph')
        })
        // res.send(compacted)
      })
      .catch((err) => {
        res.send(err)
      })
  }


})

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

    console.log(conversion_context)

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
