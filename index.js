const express = require('express')
const path = require('path')
const PORT = process.env.PORT || 5000

var app = express()
  
app.use(express.static(path.join(__dirname, 'public')))
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

const convertCSV = async (req, res) => {

  var fs = require('fs')

  var filename = req.file.filename

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
  
    readstream.on('end', () => {
      var converted_data = JSON.parse(sent_data)

      // save data

      // get inserted ids

      // generate URIs

      // add context (data vocab)
      
      // send response, convert data done.
      the_response = {
        data: converted_data
      }
      res.send(the_response)
    })

  })

  
  
}

app.post('/convert/*', upload.single('data'), (req, res) => {
  console.log(req.url)

  switch (req.url) {
    case '/convert/csv':
      convertCSV(req, res).then(function(result) {
        console.log('convert CSV done')
        // res.send(result)
      })
      break;
    default:
      res.send('conversion not happenning')
      break;
  }

})

app.post('/linking', (req, res) => {
  
  // linking entities
})