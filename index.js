const express = require('express')
const path = require('path')
const PORT = process.env.PORT || 5000
var MongoClient = require('mongodb').MongoClient
var mongo = require('mongodb')
var _ = require('lodash')
var jsonld = require('jsonld')
var $rdf = require('rdflib')
var csvtojson = require('csvtojson')

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
const xlsConverter = require('xls2json')
const xlsxConverter = require('xlsx2json')

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

  var received_url = "http://example.com" + req.url
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
        res.render('pages/rdfsubject', {
          'subj': compacted
        })
        // res.send(compacted)
      })
      .catch((err) => {
        res.send(err)
      })
  }


})


