var http = require('http'),
	qs = require('querystring'),
	request = require('request');

var Tumb = function(user, email, pwd) {
	if (!user.match(/\.tumblr\.com$/i)) {
		user = user + '.tumblr.com';
	}

	function Debug(logd) {
		if (Tumblr.debug) {
			console.log(logd);
		}
	}

	function Request(type, host, path, query, fn) {
	  var req = {
	    uri: "http://"+host+path,
	    headers: {
	      'User-Agent': 'NodeJS Tumblr Client'
	    }
	  }
	  if( type == "POST" ){
	    req.headers["Content-Type"] = 'application/x-www-form-urlencoded';
	    req.body = qs.stringify(query)  
	  } else {
	    req.uri +='?'+qs.stringify(query)
	  }
	  request(req,function(err,res,body){
	    if( err )
        return Debug('tumblr> ERROR trying to connect. Try again later.');
	    
			body = body.replace('var tumblr_api_read = ', '').replace('};','}').replace(/\n/g,'');
			fn(body);
	  })
	}

	this.main = {
		read : function(optMain, opt, fn) {
			var read_methods = {
				account : function(fn) { // OK
					Request('GET', user, '/api/read/json', {filter:'text'}, function(data) {
						var body = JSON.parse(data);
						Debug('tumblr> GET /api/read/json | account');
						if (fn) {
							fn(body.tumblelog);
						}
					});
				},
				dashboard : function(opt, fn) { // OK
					if (!email || !pwd) {
						Debug('tumblr> ERROR, missing email and/or password');
						return false;
					}

					if (!fn && typeof opt === 'function') {
						fn = opt;
					}
					else { 
						opt = opt || {}; 
					}
	
					if (opt.likes === true) { 
						opt.likes = 1; 
					}

					var thequery = {email:email, password:pwd, filter:opt.filter||'text', num:opt.num||20, start:opt.start||0, likes:opt.likes||1};

					// optional queries
					if (opt.type) {
						thequery.type = opt.type;
					}
		
					Request('POST', 'www.tumblr.com', '/api/dashboard/json', thequery, function(data) {
						var body = JSON.parse(data);
						Debug('tumblr> GET /api/dashboard/json | posts');
						if (fn) {
							fn(body.posts,body.tumblelog);
						}
					});
				},
				posts : function(opt, fn) { // OK
					if (!fn && typeof opt === 'function') {
						fn = opt;
					}
					else {
						opt = opt || {};
					}

					var thequery = {filter:opt.filter||'text', num:opt.num||20};

					// optional queries
					var type = 'POST';
					if (!email || !pwd) {
						type = 'GET';
					}
					else {
						thequery.email = opt.email;
						thequery.password = opt.pwd;
						if (opt.state) {
							thequery.state = opt.state;
						}
					}
					if (opt.tagged) {
						thequery.tagged = opt.tagged;
						if (opt.chrono) {
							thequery.chrono = opt.chrono||0;
						}
					}
					if (opt.id) {
						thequery.id = opt.id;
					}
					if (opt.search) {
						thequery.search = opt.search;
					}
					else {
						thequery.num = opt.num||20;
						thequery.start = opt.start||0;
						if (opt.type) {
							thequery.type = opt.type;
						}
					}

					Request(type, user, '/api/read/json', thequery, function(data) {
						var body = JSON.parse(data); 
						Debug('tumblr> POST /api/read/json | posts');
						if (fn) {
							fn(body.posts,body.tumblelog);
						}
					});
				}
			};

			// if not specified what to 'read' return read_methods.posts() or read_methods.dashboard() if email and password are set
			if (typeof optMain === 'function' || typeof optMain === 'object' && typeof opt === 'function') {
				if (!email || !pwd ) {
					read_methods.posts.apply(this, arguments);
				}
				else {
					read_methods.dashboard.apply(this, arguments);
				}
			}

			// reading methods via arguments[0]
			if (typeof optMain === 'string') {
				if (optMain in read_methods) {
					return read_methods[optMain].apply(this, arguments);
				}
			}
		},
		'delete' : function(id, fn) { // OK
			if (!/[0-9]*/.test(id)) {
				return false;
			}
			else {
				Request('POST', 'www.tumblr.com', '/api/delete', {email:email, password:pwd, 'post-id':id}, function() {
					Debug('tumblr> POST ' + id + ' deleted');
					if (fn) {
						fn();
					}
				});
			}
		},
		like : function(id, key, fn, api) { // OK
			var thequery = {email:email, password:pwd};
			if (typeof id === 'object') {
				fn = key;
				api = fn;
				thequery['post-id'] = id.id;
				thequery['reblog-key'] = id.key;
			}
			else {
				thequery['post-id'] = id;
				thequery['reblog-key'] = key;
			}

			var what = 'liked';

			if (api === '/api/like' || !api) {
				api = '/api/like';
			}
			else if (api === '/api/unlike') { 
				api = '/api/unlike'; 
				what = 'unliked';
			}

			Request('POST', 'www.tumblr.com', api, thequery, function() {
				Debug('tumblr> POST ' + what);
				if (fn) {
					fn();
				}
			});
		},
		unlike : function(id, key, fn, api) { // OK
			return this.like(id, key, fn, '/api/unlike');
		},
		reblog : function(id, key, fn) { // OK
			var thequery = {email:email, password:pwd};
			if (typeof id === 'object') {
				fn = key;
				api = fn;
				thequery['post-id'] = id.id;
				thequery['reblog-key'] = id.key;
				if (id.comment) {
					thequery.comment = id.comment;
				}
				if (id.as) {
					thequery.as = id.as;
				}
			}
			else {
				thequery['post-id'] = id;
				thequery['reblog-key'] = key;
			}

			Request('POST', 'www.tumblr.com', '/api/reblog', thequery, function() {
				Debug('tumblr> POST ' + thequery['post-id'] + 'reblogged');
				if (fn) {
					fn();
				}
			});
		},
		edit : function edit(opt, fn) {
			return this.write(opt, fn);
		},
		write : function write(opt, fn) { // OK
			var thequery = {};

			var toEdit = arguments.callee.caller.name;

			if (toEdit === 'edit') {
				if (opt['post-id'] || opt.id) {
					thequery['post-id'] = opt['post-id'] || opt.id;
				}
				else {
					return false;
				}
			}

			if (typeof opt !== 'object') {
				return false;
			}

			if (email && pwd) {
				
				thequery.email = email;
				thequery.password = pwd;
					
				if (opt.generator) {
					thequery.generator = opt.generator;
				}
				if (opt.date) {
					thequery.date = opt.date;
				}
				if (opt.tags) {
					thequery.tags = opt.tags;
				}
				if (toEdit !== 'edit') {

					if (opt['private']) {
						thequery['private'] = opt['private'];
						if (opt['private'] === true) {
							thequery['private'] = 1;
						}
					}
					if (opt.format) {
						thequery.format = opt.format;
					}
					if (opt.group) {
						thequery.group = opt.group;
					}
					if (opt.slug) {
						thequery.slug = opt.slug;
					}

					if (opt.state) {
						thequery.state = opt.state;
					}
					else {
						thequery.state = 'published';
					}

					if (opt['send-to-twitter']) {
						thequery['send-to-twitter'] = opt['send-to-twitter'];
					}
					else {
						thequery['send-to-twitter'] = 'no';
					}
					// writing for each type of posts

					// REGULAR || TEXT
					if (opt.type === 'regular' || opt.type === 'text') {
						thequery.type = 'regular';
						if (opt.body) {
							thequery.body = opt.body;
						}
						if (opt.title) {
							thequery.title = opt.title;
						}
					}
					// PHOTO
					else if (opt.type === 'photo') {
						thequery.type = 'photo';
						if (opt.source) {
							thequery.source = opt.source;
							if (opt.caption) {
								thequery.caption = opt.caption;
							}
							if (opt['click-through-url']) {
								thequery['click-through-url'] = opt['click-through-url'];
							}
						}
					}
					// QUOTE
					else if (opt.type === 'quote') {
						thequery.type = 'quote';
						if (opt.quote) {
							thequery.quote = opt.quote;
							if (opt.source) {
								thequery.source = opt.source;
							}
						}
						else {
							return false;
						}
					}
					// LINK
					else if (opt.type === 'link') {
						thequery.type = 'link';
						if (opt.url) {
							thequery.url = opt.url;
							if (opt.name) {
								thequery.name = opt.name;
							}
							if (opt.description) {
								thequery.description = opt.description;
							}
						}
						else {
							return false;
						}
					}
					// CONVERSATION
					else if (opt.type === 'conversation') {
						thequery.type = 'conversation';
						if (opt.conversation) {
							thequery.conversation = opt.conversation;
							if (opt.title) {
								thequery.title = opt.title;
							}
						}
						else {
							return false;
						}
					}
					// VIDEO
					else if (opt.type === 'video') {
						thequery.type = 'video';
						if (opt.embed) {
							thequery.embed = opt.embed;
							if (opt.title) { // only for vimeo
								thequery.title = opt.title;
							}
							if (opt.caption) {
								thequery.caption = opt.caption;
							}
						}
						else {
							return false;
						}
					}
					// AUDIO
					else if (opt.type === 'audio') {
						thequery.type = 'audio';
						if (opt['externally-hosted-url']) {
							thequery['externally-hosted-url'] = opt['externally-hosted-url'];
							if (opt.caption) {
								thequery.caption = opt.caption;
							}
						}
						else {
							return false;
						}
					}
				}
				else {
					for (var i in opt) {
						if (i === 'id') {
							thequery['post-id'] = opt[i];
						}
						else {
							thequery[i] = opt[i];
						}
					}
				}

				Request('POST', 'www.tumblr.com', '/api/write', thequery, function() {
					if (fn) {
						fn();
					}
				});
			}
			else {
				return false;
			}

		}
	};

	// expose main methods
	for (var i in this.main) {
		if (this.main[i]) {
			this[i] = this.main[i];
		}
	}
	delete this.main;
};

var Tumblr = module.exports = function(user, email, pwd) {
	return new Tumb(user, email, pwd);
};

// debugging on console (experimental)
Tumblr.debug = false;
