(function(){
    function getXmlHttp(){try {return new ActiveXObject("Msxml2.XMLHTTP");} catch (e) {try {return new ActiveXObject("Microsoft.XMLHTTP");} catch (ee) {}}if (typeof XMLHttpRequest!='undefined') {return new XMLHttpRequest();}}
 
    var Utility = function(){};

    Utility.prototype = {
	eventFire:function(el, etype){
	    if (el.fireEvent) {
	    	el.fireEvent('on' + etype);
	    } else {
			var evObj = document.createEvent('Events');
			evObj.initEvent(etype, true, false);
			el.dispatchEvent(evObj);
	    }
	},
	keyWhich: function(e){
	    if(window.event) { return  e.keyCode; }  // IE (sucks)
	    if(e.which) { return  e.which; }    // Netscape/Firefox/Opera
	},
	preventSubmit: function(e){
	    return A.keyWhich(e)!=13;
	},
	findParent:function(tag, node){
	    while(node && node.tagName.toLowerCase() !== tag){
		node = node.parentNode;
	    }
	    return node;
	},
	getUrl:function(url, cb) {
	    var xmlhttp = getXmlHttp();
	    //prevent cache: url+'?r='+Math.random()
	    xmlhttp.open("GET", url);
	    xmlhttp.onreadystatechange = function() {
			if (xmlhttp.readyState == 4) {
			    //only correct response supposed
			    cb(xmlhttp.responseText);
			}
	    };
	    xmlhttp.send(null);
	},
	createHtml:function(htmlStr) {
	    var frag = document.createDocumentFragment(),
            temp = document.createElement('div');
	    temp.innerHTML = htmlStr;
	    while (temp.firstChild) {
		frag.appendChild(temp.firstChild);
	    }
	    return frag;
	}

    };

    window.A = new Utility();
})();

(function(){
    var ListFilter = function() {
		this.minChars = 1;
		this.field = null;
		this.loopCall = null;
		this.nodes = null;
		this.isInitialized = false;
		this.pointer = 0;
		this.visible = [];
		this.visiblerow = "";
		this.callElement = null;
    };
    
    ListFilter.prototype = {
	init:function(idOfTheField, selector, el) {
	    if(this.isInitialized){
			this.showAll(true);
			LF.selectFirstElement();
	    }else{
			this.field = document.getElementById(idOfTheField);
			this.field.onfocus = this.onFieldIn;
			this.field.onblur = this.onFieldOut;
			this.field.onkeyup = this.onKeyUp;
			A.findParent("form", this.field).onkeydown = A.preventSubmit;
			this.nodes = document.querySelectorAll(selector);
			this.isInitialized = true;
	    }
	    this.field.value = "";
	    this.pointer = 0;
	    this.field.focus();	    
	    this.callElement = el;
	},
	onFieldIn:function() {
	    LF.loop();
	},
	onFieldOut:function() {
	    clearTimeout(LF.loopCall);
	},
	showAll:function(isDeactivate){
	    this.visible = [];
	    var row = "";
	    for (var i = 0, length = this.nodes.length; i < length; i++) {
		this.nodes[i].style.display = "inline-table";
		if(isDeactivate){
		    this.nodes[i].className = '';
		}
		this.visible.push(this.nodes[i]);
		row = row +","+i;
	    }
	    return row;
	},
	loop:function() {
	    var value = LF.field.value.trim().toLowerCase();
	    var row = "";
	    if(value.length >= this.minChars) {
		this.visible = [];
		for (var i = 0, length = this.nodes.length; i < length; i++) {
		    if(this.nodes[i].dataset["name"].toLowerCase().indexOf(value)>-1){
			this.nodes[i].style.display = "inline-table";
			this.visible.push(this.nodes[i]);
			row = row + "," + i; 
		    }else{
			this.nodes[i].style.display = "none";
		    }
		}
	    }else{
	    	row = this.showAll();
	    }
	    if(this.visiblerow!=row){
	    	LF.selectFirstElement();
	    	this.visiblerow = row;
	    }
	    LF.loopCall = setTimeout("LF.loop()", 200);
	},
	onKeyUp: function(e){
	    var keynum = A.keyWhich(e);

	    if(keynum === 38) { // up
	    	LF.selectNextElement(-1);
	    }else if(keynum === 40) { // down
	    	LF.selectNextElement(1);
	    }else if (A.keyWhich(e) === 13) { // enter
	    	LF.activateElement();
	    }else if(A.keyWhich(e) === 27){ //escape
		    if(LF.callElement != null){
		    	closeDialog();
		    }
		return false;
	    }
	},
	activateElement:function(el){
	    var active = el?el:LF.visible[LF.pointer];
	    if(LF.callElement == null){
	    	active.childNodes[0].click();
	    }else{
		    LF.callElement.value = "";
		    LF.callElement.setAttribute("title", active.dataset["name"]);
		    LF.callElement.dataset["item"] = active.dataset["id"];
		    var newClass = LF.callElement.getAttribute("class") + " itemsicon";
		    LF.callElement.setAttribute("class", newClass);
		    LF.callElement.style.backgroundPosition="0px " + active.dataset["position"]+"px";
		    closeDialog();
	    }
	},
	selectNextElement:function(inc){
	    var prev = LF.pointer;
	    LF.pointer += inc;

	    var l = this.visible.length;
	    if(LF.pointer<0){
		LF.pointer = l-1;
	    }else if(LF.pointer == l){
		LF.pointer = 0;
	    }
	    LF.selectElement(prev, LF.pointer);
	},
	selectFirstElement:function(){
		for (var i = 0, length = this.visible.length; i < length; i++) {
			this.visible[i].className = '';
		}
		
	    LF.pointer = 0;
	    LF.selectElement(-1, LF.pointer);
	},	
	selectElement:function(prev, pointer){
	    if(this.visible.length<1){
	    	return;
	    };

	    if(prev>-1){
	    	this.visible[prev].className = '';
	    }
	    this.visible[pointer].className = 'hover';
	}
    };

    window.LF = new ListFilter();  
})();


(function() {
    var ListSelect = function() {
		this.minChars = 2;
		this.field = null;
		this.countryLoopId = 0;
		this.helper = null;
		this.helperContent = "";
    };
    
    ListSelect.prototype = {
	init:function(idOfTheField, data) {
	    this.field = document.getElementById(idOfTheField);
	    this.createHelper();
	    this.field.onfocus = this.onFieldIn;
	    this.field.onblur = this.onFieldOut;
	    this.field.onkeyup = this.onKeyUp;
	    A.findParent("form", this.field).onkeydown = A.preventSubmit;
	    //focus on open page
	    this.field.focus();
	},
	onFieldIn:function() {
	    LS.loop();
	},
	onFieldOut:function() {
	    clearTimeout(LS.countryLoopId);
	    setTimeout("LS.hideHelper()", 200);
	},
	loop:function() {
	    var list = "";
	    var value = LS.field.value.trim();
	    if(value.length >= this.minChars) {
		var numOfChampions = champions.length;
		for(var i=0; i<numOfChampions; i++) {
		    if(champions[i].name.toLowerCase().indexOf(value.toLowerCase().trim())!=-1) {
			list += 
			'<li><a href="' + champions[i].link + '"><span class="icon"><span style="background-position: 0px '+ champions[i].sprite+'px;"></span></span><span class="name">' + champions[i].name + '</span></a></li>';
		    }
		}
	    }
	    if(list != '') {
		list = '<ul class="table champions active">'+list+'</ul>';
		if(this.helperContent != list) {
		    this.helperContent = list;
		    this.helper.innerHTML = this.helperContent;
		    LS.selectFirstElement();
		}
		this.showHelper();
	    } else {
		this.hideHelper();
	    }
	    LS.countryLoopId = setTimeout("LS.loop()", 200);
	},
	setChampion:function(champion) {
	    this.field.value = champion;
	    this.hideHelper();
	},
	//keyboard
	onKeyUp: function(e){
	    var keynum = A.keyWhich(e);

	    if(keynum === 38) { // up
		LS.selectNextElement(-1);
	    }else if(keynum === 40) { // down
		LS.selectNextElement(1);
	    }else if (A.keyWhich(e) === 13) { // enter
		LS.activateElement();
		return false;
	    }
	},
	selectNextElement:function(inc){
	    var prev = LS.pointer;
	    LS.pointer += inc;

	    var l = this.helper.children[0].children.length;
	    if(LS.pointer<0){
		LS.pointer = l-1;
	    }else if(LS.pointer == l){
		LS.pointer = 0;
	    }
	    LS.selectElement(prev, LS.pointer);
	},
	selectFirstElement:function(){
	    LS.pointer = 0;
	    LS.selectElement(-1, LS.pointer);
	},	
	selectElement:function(prev, pointer){
	    if(prev>-1){
		this.helper.children[0].children[prev].className = '';
	    }
	    this.helper.children[0].children[pointer].className = 'hover';
	},
	activateElement: function(){
	    if(this.helper.children[0] === undefined){
	    }else{
		this.helper.children[0].children[LS.pointer].children[0].click();
	    }
	},
	// helper
	createHelper:function() {
	    this.helper = document.createElement("div");
	    this.helper.style.width = this.field.offsetWidth + "px";
	    this.helper.setAttribute("id", "helper");
	    this.helper.setAttribute("class", "absolute autocomplite");
	    this.helper.innerHTML = "";
	    document.body.appendChild(this.helper);
	    this.positionHelper();
	    this.hideHelper();
	},
	positionHelper:function() {
	    var position = {x:0, y:0};
	    var e = this.field;
	    while(e) {
		position.x += e.offsetLeft;
		position.y += e.offsetTop;
		e = e.offsetParent;
	    }
	    this.helper.style.left = position.x + "px";
	    this.helper.style.top = (position.y + this.field.offsetHeight)+ "px";
	},
	showHelper:function() {
	    this.helper.style.display = "block";
	},
	hideHelper:function() {
	    this.helper.style.display = "none";
	    this.helper.innerHTML = "";
	    this.helperContent = "";
	}
    };

    window.LS = new ListSelect();
})();

//activate champion selection
LS.init("s");

//activate item selection
var nodes = document.querySelectorAll("#itemsFilter");
for (var i = 0, length = nodes.length; i < length; i++) {
    LF.init("itemsFilter", ".items li", null);
}

//global close dialogs
function closeDialog(){
    document.getElementById("overlay").click();
}

//activate items selection in comments
function selectItem(dialog, el){
    var overlay = document.getElementById("overlay");
    overlay.onclick = function(){
		overlay.style.display = "none";
		dialog.style.display = "none";
    };
    overlay.style.display="block";    
    dialog.style.display = "block";
    
    LF.init("itemsFilter", "#dialogItems li", el);
}

var nodes = document.querySelectorAll(".iconselect");
for (var i = 0, length = nodes.length; i < length; i++) {
    nodes[i].onclick=function(){	
	var el = this;
	var dialog = document.getElementById("dialogItems");
	if(typeof dialog != 'undefined' && dialog != null){
	    selectItem(dialog, el);
	}else{
	    A.getUrl('/dialogs/items',function(data){
		document.body.appendChild(A.createHtml(data));
		var dialog = document.getElementById("dialogItems");
		selectItem(dialog, el);
	    });
	}
    };
}