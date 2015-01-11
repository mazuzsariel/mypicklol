/*
	Read data from files and put it in to the memory
*/
var fs = require('fs');
var path = require('path');
var _ = require('underscore');
var mustache = require('mustache');
var sqwish = require('sqwish');
var uglifyJS = require("uglify-js");
var utils = require('../server/utils.js');
var htmlminifier = require('html-minifier');

var readLangTags = function(cb){
    utils.readJson(
	app.__.config.folder.languages+'/'+app.__.config.language+'.json', 
	cb
    );
};

var readConfigTags = function(cb){
    utils.readJson(app.__.config.config.core, cb);
};

var readNews = function(cb){
    utils.readJson(app.__.config.data.news,cb);
};

var readPage = function(pageName, cb){
    utils.readJson(app.__.config.folder.dynamic+'/'+pageName, cb);
};

var readChampions = function(cb){
    utils.readJson(app.__.config.data.champions, cb);
};

var readItems = function(cb){
    utils.readJson(app.__.config.data.items, function(items){
    	fs.stat(app.__.config.data.items, function(err, stats){
    		if (err) throw err; 		 
    		var month = (stats.mtime.getMonth() + 1);
    		var day = stats.mtime.getDate();
    		items.date = stats.mtime.getFullYear()+"-"+(month<10?"0":"")+month+"-"+(day<10?"0":"")+day;
    		cb(items);
    	})
    });
};

var readCounters = function(cb){
    utils.readJson(app.__.config.data.counters, cb);
};

var compileCss = function(cb){
    var filename=app.__.config.css.core;
    fs.readFile(filename, 'utf8', function(err, data) {
        if (err) throw err;
        var minifiedCss = sqwish.minify(data);	
	fs.writeFile(app.__.config.css.corestatic, minifiedCss, function(err) {
	    if(err) throw err;
	    cb(minifiedCss);          
	}); 
    });
};

var readJs = function(cb){
    if(app.__.config.dev){
	//do not compress in the case of dev environment
	fs.readFile(app.__.config.js.core, 'utf8', function(err, data) {
            if (err) throw err;
	    cb(data);
	});	
    }else{
	var result = uglifyJS.minify(app.__.config.js.core);
	cb(result.code);
    }
};

var readTemplates = function(cb){
    var templates = {};
 
    fs.readdir(app.__.config.folder.templates,  function(err, list) {
	if (err) throw err;
	var l = list.length;
	if(!l) return cb(templates);
	list.forEach(function(item) {
	    fs.readFile(
		app.__.config.folder.templates+'/'+item,
		'utf8',
		function(err, data){
		    if(err)throw err;
		    templates[item] = data;
		    if (!--l) return cb(templates);
		});
	    
	});
    });
};

var constructPage = function(tags, partials, templates, page, pageName, cb){
	//do not load development pages on prod
	if((!app.__.config.dev) && 
			(pageName == "dialogs-items.json")){
		return cb();
	}

	var outKey = path.basename(pageName, path.extname(pageName)).replace("-","/");
    
    var tag = (page.hasOwnProperty("tags")?
	       _.extend({}, tags, page.tags):
	       tags);

    var tmp = page.templates;
    for(var key in tmp){
	if (tmp.hasOwnProperty(key)) {
	    tmp[key] = templates[tmp[key]];
	}			
    }

    partials = _.extend({}, partials,  _.omit(tmp, 'page'));
    var page = tmp['page'];  
    
    switch(outKey){  
	    case "counter":
		constructCounterPage(outKey, page, tag, partials, cb);
		break;
	    case "news":
		constructNewsPage(outKey, page, tag, partials, cb);
		break;
	    case "item":
	    constructItemPage(outKey, page, tag, partials, cb);	
	    break;
	    default:
		constructDefaultPage(outKey, page, tag, partials, cb);
    }

};

var constructNewsPage = function(outKey, page, tag, partial, cb){
 
    readNews(function(newsSource){
	var championsMap = extractChampionsMap(tag);

	var maxInRow =9;

	var news = [];
	if(newsSource.newChampions){
	    for(var i=0; i<newsSource.newChampions.length; i++){
		news.push(richCounters(newsSource.newChampions[i], championsMap, tag,  maxInRow));
	    };
	};

	for(var i=0; i<newsSource.counters.length; i++){
	    news.push(richCounters(newsSource.counters[i], championsMap, tag, maxInRow));
	};

	
	var url = '/'+ outKey;
	var fullUrl = app.__.config.domain.site+url;
	var customTag = {
	    "datefrom":newsSource.datefrom,
	    "dateto":newsSource.dateto,
	    "news":news,
	    "url":{
			"img":app.__.config.domain.site+"/img/home.png",
			"full":fullUrl,
			"encoded":encodeURIComponent(fullUrl)
	    }
	};
	
	customTag =  _.extend({}, tag, customTag);

	mustache.clearCache();
	var data = mustache.render(page, customTag, partial);
	compressAndRenderPage(url, data);
	addToSiteMap(fullUrl, newsSource.dateto, 1, "weekly");
	
	console.log("rendered: "+outKey);
	return cb();
    });
};

var constructDefaultPage = function(outKey, page, tag, partial, cb){
    var url = '/'+(outKey=="index"?"":outKey);
    var fullUrl = app.__.config.domain.site+(url=="/"?"":url);
    tag["url"]={
	"img":app.__.config.domain.site+"/img/home.png",
	"full":fullUrl,
	"encoded":encodeURIComponent(fullUrl)
    };

    mustache.clearCache();
    var data = mustache.render(page, tag, partial);

    compressAndRenderPage(url, data);

    //exclude loaded ajax data from sitemap
    if(outKey.indexOf("dialogs/")!=0){
	addToSiteMap(fullUrl, tag.date, 0.5, "weekly");
    }

    console.log("rendered: "+outKey);

    return cb();
};

var wrapProgress = function(arr, k, tag){
    if(arr[k].power == 0){
	arr[k].progress=tag.lang["champion"]["progress"]["deleted"];
	delete arr[k].power;
    }else if(arr[k].power == arr[k].progress){
	arr[k].progress=tag.lang["champion"]["progress"]["new"];
    }else if(arr[k].progress == 0){
	delete arr[k].progress;
    }else if(arr[k].progress <0){
	arr[k].progressdown = true;
    }
};

var richCounters = function(champion, championsMap, tag,  maxInRow){
    var customTag = {
	 "champion":championsMap[champion.nameEncoded]
    };

    var stronger = champion.stronger;
    if(stronger && stronger.length>0){
	for(var k=0; k<stronger.length; k++){
	    stronger[k] = _.extend(
		stronger[k], 
		championsMap[stronger[k].nameEncoded]);
	    wrapProgress(stronger, k, tag);
	}

	var strongerLow = _.rest(stronger, maxInRow+1);
	if(strongerLow){
	    shiftSpriteToSmall(strongerLow);
	    customTag["strongerlow"]=strongerLow;
	}

	stronger = _.first(stronger, maxInRow);
	customTag["stronger"] = stronger;
	customTag["isstronger"] = true;
    }

    var weaker = champion.weaker;
    if(weaker && weaker.length>0){
	for(var k=0; k<weaker.length; k++){
	    weaker[k] = _.extend(
		weaker[k], 
		championsMap[weaker[k].nameEncoded]);
	    wrapProgress(weaker, k, tag);
	}

	var weakerLow = _.rest(weaker, maxInRow+1);
	if(weakerLow){
	    shiftSpriteToSmall(weakerLow);
	    customTag["weakerlow"] = weakerLow;
	}

	weaker = _.first(weaker, maxInRow);
	customTag["weaker"] = weaker;
	customTag["isweaker"] = true;
    }

    return customTag;
};

var extractChampionsMap = function(tags){
    var championsMap = {};
    for(var i=0; i<tags.champions.length; i++){
	championsMap[tags.champions[i].nameEncoded] = tags.champions[i];
    };
    return championsMap;
};

var constructItemPage = function(outKey, page, tag, partial, cb){
	tag.items.data.forEach(function(item) { 
	    var customTag = _.extend({
			"item":item
		    }, tag);
	    
	    mustache.clearCache();
	    var data = mustache.render(page, customTag, partial);
	    compressAndRenderPage(item.linkLocal, data);
	    addToSiteMap(item.link, tag.items.date, 1, "weekly");
	});
	console.log("rendered: "+outKey);
	return cb();
}

var constructCounterPage = function(outKey, page, tag, partial, cb){
	var championArticles = JSON.parse(fs.readFileSync(app.__.config.data.articles));
    var championsMap = extractChampionsMap(tag);

    readCounters(function(countersSource){
	counters = countersSource.counters;
	for (var i=0; i<counters.length; i++){
	    var customTag = richCounters(counters[i], championsMap, tag, 11);
	    var key = customTag.champion.nameEncoded;
	    tag.title = customTag.champion.name;
	    if (championArticles[key] !== undefined)
	    	tag.article = championArticles[key].article;

	    var url = '/'+ key;
	    var fullUrl = app.__.config.domain.site+url;
	    customTag = _.extend({
		"url":{
		    "img":app.__.config.domain.site+"/img/champions/"+key+"/champion.png",
		    "full":fullUrl,
		    "encoded":encodeURIComponent(fullUrl)
		}
	    }, tag, customTag);

	    mustache.clearCache();
	    var data = mustache.render(page, customTag, partial);
	    compressAndRenderPage(url, data);
	    addToSiteMap(fullUrl, countersSource.date, 1, "weekly");
	}
	console.log("rendered: "+outKey);
	return cb();
    });

};

var shiftSpriteToSmall = function (champions){
    for(var k=0; k<champions.length; k++){	
    	var s = Number(champions[k].sprite);
    	champions[k].sprite = s - (30*(s/80));
    } 
};

var addToSiteMap = function (loc, lastmod, priority, changefreq){
    siteMap.url.push({
	"loc":loc,
	"lastmod":lastmod,
	"priority":priority,
	"changefreq":changefreq	
    });
};

var renderSiteMap = function(cb){
    fs.readFile(
	app.__.config.utilpages.sitemap,
	'utf8',
	function(err, data){
	    if(err)throw err;
	    var url = "/sitemap.xml";

	    mustache.clearCache();
	    var page = mustache.render(data, siteMap);
	    renderPage(url, page, "text/xml");

	    console.log("rendered: sitemap.xml");
	    return cb();
	});
};

var renderRobotsTxt = function(cb){
    fs.readFile(
	app.__.config.utilpages.robots,
	'utf8',
	function(err, data){
	    if(err)throw err;
	    var url = "/robots.txt";
	    renderPage(url, data, "text/plain");
	    console.log("rendered: robots.txt");
	    return cb();
	});
};

var compressAndRenderPage = function(url, data, contentType){
    data = htmlminifier.minify(data, {
		removeComments: true,
		removeCommentsFromCDATA: true,
		collapseWhitespace: true,
		collapseBooleanAttributes: true,
		removeAttributeQuotes: true,
		removeEmptyAttributes: true
    });
    renderPage(url, data, contentType);
};

var renderPage = function(url, data, contentType){
    app.get(url, function(req,res){
	if(contentType != undefined){
	    res.set('Content-Type', contentType);
	}
	res.send(data);
    });
};

var siteMap = null;
var readPages = function(tags, partials, templates, cb){   
    fs.readdir(app.__.config.folder.dynamic, function(err, list){
	if(err) throw err;
	var l = list.length;
	if(!l) return cb();
	siteMap = {"url":[]};
	list.forEach(function(pageName) { 
	    readPage(pageName, function(page){
			constructPage(tags, partials, templates, page, pageName, function(){
			    if (!--l){
				renderSiteMap(function(){
				    renderRobotsTxt(cb);
				});		
			    }
			});
	    });
	});
    });		    
};

var encodeName = function (name){
	return name.replace(/ /g,'-').replace(/\'/g,'').replace(/\./g,'').replace(/:/g,'').replace(/\(/g,'').replace(/\)/g,'').toLowerCase();
}

var richItems = function (rawItems, items){
	var size = 32;
	var originalSize = 48;
	
	var res = [];
	if(items){
		for (var i = 0; i < items.length; i++) {
			var item = rawItems[items[i]];
			if(item){
				res.push({
					"name":item.name,
					"x":item.image.x/originalSize*size,
					"y":item.image.y/originalSize*size,
					"link":item.link,
					"sprite":item.image.sprite
				});
			}
		}
	}
	return res;	
}

var app = null;
function loadAsync(_app, cb){
    app = _app;
    
    compileCss(function(css){
    readConfigTags(function(configTags){
    readLangTags(function(langTags){ 
    readTemplates(function(templates){
    readJs(function(js){
    readItems(function(items){	
    readChampions(function(champions){
	
	var homepageUrl = app.__.config.domain.site;
	var chmps = champions.champions;
	var chmpsJs = [];
	for(var i=0; i<chmps.length; i++){
	    chmps[i].link = homepageUrl + "/" + chmps[i].nameEncoded;
	    chmpsJs.push({
		"name":chmps[i].name,
		"nameEncoded":chmps[i].nameEncoded,
		"sprite":chmps[i].sprite,
		"link":chmps[i].link
	    });
	};
	
	var normalizedItems = {
			"data":[],
			"ids":{},
			"date":items.date
	};
	
	var isbonetooth = false;
	for(var prop in items.data){
		if (items.data.hasOwnProperty(prop)) {
			var newItem = items.data[prop];
			newItem.id = prop;			
			newItem.nameEncoded = encodeName(newItem.name);
									
			//spec links for enchantment's
			if(newItem.nameEncoded.indexOf("enchantment-")==0 ){
				newItem.nameEncoded = encodeName(items.data[newItem.from[0]].name)+"-"+newItem.nameEncoded;
			}
			//spec links for bonetooth 
			if(newItem.nameEncoded.indexOf("bonetooth-")==0 ){
				if(isbonetooth){
					continue;
				}else{
					isbonetooth = true;
				}
			}
			
			
			newItem.linkLocal = "/items/" + newItem.nameEncoded;
			newItem.link=homepageUrl + newItem.linkLocal;
			
			var description = newItem.description;
			description = description.replace(/<stats>/g, "<span class=\"inline tcg\">").replace(/<\/stats>/g,"</span>");
			description = description.replace(/<unique>/g, "<span class=\"inline tcb mrn\">").replace(/<\/unique>/g,"</span>");
			description = description.replace(/<passive>/g, "<span class=\"inline tcb mrn\">").replace(/<\/passive>/g,"</span>");
			description = description.replace(/<active>/g, "<span class=\"inline tcr mrn\">").replace(/<\/active>/g,"</span>");
			description = description.replace(/<consumable>/g, "<span class=\"inline tcb mrn\">").replace(/<\/consumable>/g,"</span>");
			
			description = description.replace(/<i>/g, "<span class=\"inline ts tdi\">").replace(/<\/i>/g,"</span>");
			description = description.replace(/<font color='#FDD017'>/g,"<span class=\"inline ts tdi\">").replace(/<\/font>/g,"</span>");
			
			
			newItem.description = description;
			
			if(newItem.plaintext && newItem.plaintext.indexOf("game_item_plaintext_")==0){
				delete newItem.plaintext;
			}
			if(newItem.gold && !newItem.gold.purchasable){
				delete newItem.gold;
			}
			
			normalizedItems.data.push(newItem);
			normalizedItems.ids[prop]=newItem;
		}
	}

	//"from & to" calculation, we need to do this post calculation links for all items
	for(var prop in normalizedItems.ids){
		if (normalizedItems.ids.hasOwnProperty(prop)) {
			var item = normalizedItems.ids[prop];
			item.fromFormatted = richItems(normalizedItems.ids, item.from);
			item.intoFormatted = richItems(normalizedItems.ids, item.into);
			item.fromFormattedPresent = item.fromFormatted.length>0;
			item.intoFormattedPresent = item.intoFormatted.length>0;
		}
	}
	
	normalizedItems.data = _.sortBy(normalizedItems.data, function(item){
		return item.name; 
	});
	
	var tags = {
	    "config":_.extend({},configTags.config,app.__.config),
	    "lang":langTags.lang,
	    "css":css,
	    "js":js,
	    "championsJs":JSON.stringify(chmpsJs),
	    "encodeUri":function(){
	    	return function(text, render) {
	    		return encodeURIComponent(render(text));
	    	};
	    },
	    "homepageUrl":homepageUrl,
	    "items":normalizedItems
	};
	var tagsCb = tags;
  	tags = _.extend({}, tags, champions);	

	var partials = langTags.partials;

	readPages(tags, partials, templates, function(){
	    return cb(tagsCb); 
	});
    });});});});});});});
}

exports.load = loadAsync;
