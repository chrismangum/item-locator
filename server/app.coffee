express = require 'express'
http = require 'http'
path = require 'path'

app = express()
app.use express.logger 'dev'
app.use express.static 'public'

http.createServer(app).listen process.env.PORT or 3000
