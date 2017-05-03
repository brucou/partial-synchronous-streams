import fs from "fs"
import express from "express"
import Handlebars from "handlebars"
import webpack from "webpack"
import webpackDevMiddleware from "webpack-dev-middleware"
import webpackHotMiddleware from "webpack-hot-middleware"
import browserSync from "browser-sync"

const port = process.env.PORT || 3000
const app = express()
const env = 'development'

const webpackConfig = require('./webpack.config')
const compiler = webpack(webpackConfig)
const hot = webpackHotMiddleware(compiler)
const sync = browserSync.create()

app.use(webpackDevMiddleware(compiler, webpackConfig.devServer))
app.use(hot)
app.use(express.static('dist'))

sync.init({
  proxy: `localhost:${port}`,
  notify: false,
  open: false,
}, () => {
  console.log('BrowserSync ready')
})

const compileHtml = () => {
  const indexSource = fs.readFileSync(`./index.html`,
    { encoding: 'utf-8' })
  const template = Handlebars.compile(indexSource)
  const html = template({ ...process.env })

  return html
}

const html = compileHtml()

app.get('*', (req, res) => {
  if (env === 'development') {
    res.send(compileHtml())
  } else {
    res.send(html)
  }
})

app.listen(port, () => console.log(`Listening on ${port}`))

export default app
