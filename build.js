import webpack from 'webpack'
import {spawn} from 'child_process'

const webpackConfig = require('./webpack.config')
const compiler = webpack(webpackConfig)
console.log('Webpack build')
compiler.run((err, stats) => {
  if (err) {
    console.error('Webpack error', err)
    process.exit(1)
  }

  console.log('Webpack built')
  if (stats.hasErrors()) {
    console.log(stats.toString('errors-only'))
    process.exit(1)
  } else {
    console.log(stats.toString({
      chunks: false,
      colors: true,
    }))
  }

  if (process.env.BUGSNAG_API_KEY) {
    const urls = {
      development: 'http://localhost:4000',
    }

    const baseUrl = urls[process.env.BUILD_ENV]
    if (!baseUrl) { return }

    console.log('Uploading sourcemaps to bugsnag')
    const child = spawn('curl', [
      'https://upload.bugsnag.com',
      `-F apiKey=${process.env.BUGSNAG_API_KEY}`,
      `-F overwrite=true`,
      `-F minifiedUrl=${baseUrl}/bundle.js`,
      `-F sourceMap=@dist/bundle.js.map`,
    ])

    child.on('close', code => {
      console.log('Sourcemap upload finished with code', code)
    })
  }
})
