'use strict';
 
/**
* Web Scraper
*/
// Instead of the default console.log, you could use your own augmented console.log !
// var console = require('./console');
 
// Url regexp from http://daringfireball.net/2010/07/improved_regex_for_matching_urls

var EXTRACT_URL_REG = /\b((?:https?:\/\/|www\d{0,3}[.]|[a-z0-9.\-]+[.][a-z]{2,4}\/)(?:[^\s()<>]+|\(([^\s()<>]+|(\([^\s()<>]+\)))*\))+(?:\(([^\s()<>]+|(\([^\s()<>]+\)))*\)|[^\s`!()\[\]{};:'".,<>?«»“”‘’]))/gi;

var PORT = 3000;
 
var request = require('request');
 
// See: http://expressjs.com/guide.html
var express = require('express');
var app = express();
 
// You should (okay: could) use your OWN implementation here!
var EventEmitter = require('events').EventEmitter;
 
// We create a global EventEmitter (Mediator pattern: http://en.wikipedia.org/wiki/Mediator_pattern )
var em = new EventEmitter();
 
/**
* Remainder:
* queue.push("http://..."); // add an element at the end of the queue
* queue.shift(); // remove and get the first element of the queue (return `undefined` if the queue is empty)
*
* // It may be a good idea to encapsulate queue inside its own class/module and require it with:
* var queue = require('./queue');
*/
var queue = [];
var lien_done = [];
 
/**
* Get the page from `page_url`
* @param {String} page_url String page url to get
*
* `get_page` will emit
*/
function get_page(page_url){
  em.emit('page:scraping', page_url);

  //copy of the visited link
  lien_done.push(page_url);

  // See: https://github.com/mikeal/request
  request({ url:page_url,}, function(error, http_client_response, html_str){
    /**
    * The callback argument gets 3 arguments.
    * The first is an error when applicable (usually from the http.Client option not the http.ClientRequest object).
    * The second is an http.ClientResponse object.
    * The third is the response body String or Buffer.
    */
	 
    /* 
    * created variable for new informations about the page include in http_client_response
    */
    var page_server = "not precised";
    var page_type = "not precised";
    var page_length = "not precised";
    var page_compression = "not precised";
    if (!(http_client_response === undefined)){
      if (!(http_client_response.headers.server === undefined)){
        var page_server = http_client_response.headers.server;
      }
      if (!(http_client_response.headers['content-type'] === undefined)){
        var page_type = http_client_response.headers['content-type'];
      }
      if (!(http_client_response.headers['content-length'] === undefined)){
        var page_length = http_client_response.headers['content-length'];
      }
      if (!(http_client_response.headers['content-encoding'] === undefined)){
        var page_compression = http_client_response.headers['content-encoding'];
      }
    }

    if(error){
      em.emit('page:error', page_url, error);
      return;
    }
  em.emit('page', page_url, html_str, page_server, page_type, page_length, page_compression);

  // recuperation in queue of the next linh to explore
  get_page(queue.shift());
  });
}
 
/**
* Extract links from the web page
* @param {String} html_str String that represents the HTML page
*
* `extract_links` should emit an `link(` event each
*/
function extract_links(page_url, html_str){
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/match
  // "match" can return "null" instead of an array of url
  // So here I do "(match() || []) in order to always work on an array   (and yes, that's another pattern).
  (html_str.match(EXTRACT_URL_REG) || []).forEach(function(temp_url){
    // see: http://nodejs.org/api/all.html#all_emitter_emit_event_arg1_arg2

    /*
    * check in the visited links and the links will be visited for avoid to explore several times the same links
    */
    if(lien_done.indexOf(temp_url)==-1 && queue.indexOf(temp_url)==-1){
      em.emit('url', page_url, html_str, temp_url);
    }
  });
}
 
function handle_new_url(from_page_url, from_page_str, url){
  // Add the url to the queue
  queue.push(url);
  // ... and may be do other things like saving it to a database
  // in order to then provide a Web UI to request the data (or monitoring the scraper maybe ?)
  // You'll want to use `express` to do so
}
 
 
em.on('page:scraping', function(page_url){
  console.log('=================================');
  console.log('=================================');
  console.log('Loading... ', page_url);
});
 
// Listen to events, see: http://nodejs.org/api/all.html#all_emitter_on_event_listener

/*
* modified to show new informations of the page
*/
em.on('page', function(page_url, html_str, page_server, page_type, page_length, page_compression){
  console.log('---------------------------------');
  console.log('We got a new page!', page_url);
  console.log('Size : ', page_length);
  console.log('Language/Server : ', page_server);
  console.log('Compression type : ', page_compression);
  console.log('Type : ', page_type);
  console.log('=================================');
});
 
em.on('page', extract_links);

em.on('page:error', function(page_url, error){
  console.error('Oops an error occured on', page_url, ' : ', error);
  // in case of error, we go to the next link
  get_page(queue.shift());
});
 
em.on('url', function(page_url, html_str, url){
  console.log('We got a new link! ', url);
});
 
em.on('url', handle_new_url);
 
 
// A simple (non-REST) API
// You may (should) want to improve it in order to provide a real-GUI for:
// - adding/removing urls to scrape
// - monitoring the crawler state
// - providing statistics like
// - a word-cloud of the 100 most used word on the web
// - the top 100 domain name your crawler has see
// - the average number of link by page on the web
// - the most used top-level-domain (TLD: http://en.wikipedia.org/wiki/Top-level_domain )
// - ...
 
// You should extract all the following "api" related code into its own NodeJS module and require it with
// var api = require('./api');
// api.listen(PORT);

app.get('/home', function(req, res){
  // See: http://expressjs.com/api.html#res.json
  res.send(require('fs').readFileSync('ui.html').toString());
  res.json(200, {
    title:'YOHMC - Your Own Home Made Crawler',
    endpoints:[{
      url:'http://127.0.0.1:'+PORT+'/queue/size',
      details:'the current crawler queue size'
    }, {
      url:'http://127.0.0.1:'+PORT+'/queue/add?url=http%3A//voila.fr',
      details:'immediately start a `get_page` on voila.fr.'
    }, {
      url:'http://127.0.0.1:'+PORT+'/queue/list',
      details:'the current crawler queue list.'
    }]
  });
});
 
app.get('/queue/size', function(req, res){
  res.setHeader('Content-Type', 'text/plain');
  res.json(200, {queue:{length:queue.length}});
});
 
app.get('/queue/add', function(req, res){
  var url = req.param('url');
  get_page(url);
  res.json(200, {
    queue:{
      added:url,
      length:queue.length,
    }
  });
});
 
app.get('/queue/list', function(req, res){
  res.json(200, {
    queue:{
      length:queue.length,
      urls:queue
    }
  });
});
 
app.listen(PORT);
console.log('Web UI Listening on port '+PORT);
 
// #debug Start the crawler with a link
if(process.argv[2]===undefined){
  var start_url = 'http://twitter.com/FGRibreau';
}else{
  var start_url = process.argv[2];
}
get_page(start_url);
