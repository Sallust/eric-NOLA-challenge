var categories = ["food","drinks", "coffee", "arts"];

var topPicks = ["Good Friends", "Corner Pocket", "Cafe Lafittes in Exile", "700 club", "Rawhide"];

var markerIconArray = ['img/top_picks.png', 'img/restaurant.png', 'img/drinks.png', 'img/coffee.png', 'img/arts.png'];

/**
* @description Organizes data required for project encapsulates
*/
var Model = {
	resultsLimit: 5, // results limit of Foursquare return
	topPicksPlaceArray: ko.observableArray(), //set as property so variable is available to ViewModel on initial run
	/**
	* @description Called on successful map load, sets up data structured e names
	*/
	init: function() {
		categories.forEach(function(category){
			var categoryArrayName = category + "PlaceArray";
			Model[category] = ko.observableArray(); // will hold array of place names from foursquare API call
			Model[categoryArrayName] = ko.observableArray(); //will hold array of place objects
			vm.arrayOfArrays.push(Model[categoryArrayName]); //pushes array to ViewModel 'mother array' so vm can easily access data
			if(Model[category]().length === 0) {  //only make Foursquare call when array holding foursquare results is empty
				Model.getFoursquareList(category);
			}
		});
		Model.getData('topPicks', topPicks); //makes call to get Data for Top Picks for initial page load
	},
	/**
	* @description Makes call to get data from localStorage if available, otherwise makes call to get Google data
	* @param {string} category - Name of the category
	* @param {array} placeNameList - Simple array of place names
	*/
	getData: function(category, placeNameList) {
		var categoryArrayName = category + "PlaceArray";
		var categoryLocalStorage = category + "LocalStorage";
		if (!localStorage[categoryLocalStorage]) { // checks only this category to see if exists in Local Storage
			placeNameList.forEach(function(placeName){
				MapFunc.getInitialData(placeName, Model[categoryArrayName], categoryLocalStorage);
			});
		} else {
			Model.populateFromLocalStorage(category, categoryArrayName);
		}
	},
	/**
	* @description Makes call to foursquare API, on fail supplies results from an earlier load
	* @param {string} category - Name of the category
	*/
	getFoursquareList: function(placeCategory) {
		var category = placeCategory;
		var foursquareAPI = 'https://api.foursquare.com/v2/venues/explore?client_id=EVYYCGOOZ5MFLVODPTDVDSDZEFQXD4TBNDIGOYTWOT0SQZHJ&client_secret=EWZJ2VJM5HRURCEVMSXQ3LEVVPL1PZXND5RHNAFNOYRTH3JS&v=20150826&ll=29.96,-90.06&section=' + category + '&limit=' + Model.resultsLimit + '&radius=2000';
		$.getJSON(foursquareAPI, function(data) {
			for (var i = 0; i < data.response.groups[0].items.length; i++) {
				var resultName = data.response.groups[0].items[i].venue.name;
				Model[category]().push(resultName);
			}
		}).fail(function() {
			Model[category](["Public Fish & Oyster", "Continental Divide", "Albemarle Baking Company", "The Whiskey Jar", "Revolutionary Soup"]);
			if (!Model.hasReceivedError) { //User only receives error once, not for each category
				alert("Foursquare Issue... Oh No! Showing you the results from 1/22/2016. Try reloading in a minute");
			}
			Model.hasReceivedError = true;
		});
	},
	/**
	* @description Uses name of category to look in LocalStorage and convert string to a useable array
	* @param {string} category - Name of the category
	* @returns {array} category - Array containing placeIDs of one category's places
	*/
	getPlaceIdArray: function(category) {
		var nameStr = category + "LocalStorage";
		if(!localStorage[nameStr]){ //if an error prevented string of placeIDs being saved, possible in rare instances after a Google over query limit issue
			return [];
		} else {
			var str = localStorage[nameStr].slice(0,-1); //remove trailing comma
			return str.split(','); //generates array from long string of place ID's
		}
	},
	/**
	* @description Called by get Data, uses category's placeID array to access saved PlaceData from google
	* @param {string} category - Name of the category
	* @param {string} categoryArrayName - Array to hold names of foursquare results
	*/
	populateFromLocalStorage: function(category, categoryArrayName) {
		var placeIdArray = Model.getPlaceIdArray(category);
	 		placeIdArray.forEach(function(placeId){
				Model[categoryArrayName].push( new Place(JSON.parse(localStorage[placeId]))); // data is parsed from string to object similar to initial google placeData object
			});
	},
	/**
	* @description Called on callback of placeData from google, creates placeID: placeData string within local storage, also creates a list of placeIDs for each category
	* @param {object} results - placeData object returned from Google
	* @param {string} category - Name of the category
	*/
	saveInLocalStorage: function(results, category) {
		var resultsString = (JSON.stringify(results));
		localStorage.setItem(results.place_id, resultsString); // stringified placeData set to key
		var placeIdList = ( localStorage[category] || '' ) + results.place_id + ',';
		localStorage.setItem( category , placeIdList );
	},
	/**
	* @description Called by place contructor, gets wiki url replacing an empty string if successful
	* @param {object} placeObj - Place Object
	*/
	getWikiUrl: function(placeObj) {
		var place = placeObj;
		var wikiAPI = 'https://en.wikipedia.org/w/api.php?action=opensearch&search=' + place.name +'&format=json';

		var wikiRequestTimeout = setTimeout(function(place) {
        	place.wikiURL('');
    	}, 5000, place);

		$.ajax({
			url: wikiAPI,
			dataType: "jsonp",
			success: function(data) {
				place.wikiURL(data[3][0]);
				clearTimeout(wikiRequestTimeout);
			}
		});
	},
	/**
	* @description Called by constructor, gets photoUrl from placeData object or from  LocalStorage
	* @description Deals with the loss of function getURL when stringifying and parsing placeData obj
	* @param {object} placeObj - the place object
	* @param {array} photoData - the photo property of the placeData from google or LocalStorage
	*/
	getPhotoUrl: function(placeObj, photoData) {
		var place = placeObj;
		if(typeof photoData == "undefined") {
			return "http://lorempixel.com/65/65/nightlife/" + Math.floor(Math.random()*10) ;
		}
		var isFromLocalStorage = !photoData[0].getUrl; //getUrl is a method lost in the LocalStorage obj
		if (isFromLocalStorage) {
			var keyName = place.placeID + "photo";
			return localStorage[keyName];
		} else {
			var photoUrl = photoData[0].getUrl({'maxWidth':100, 'maxHeight':100});
			this.savePhotoinLocalStorage(photoUrl,place.placeID);
			return photoUrl;
		}
	},
	/**
	* @description generates a key in localStorage to save photoURL, and saves it there
	* @param {string} photoUrl -  initial photo URL result from getURL method
	* @param {string} placeID -
	*/
	savePhotoinLocalStorage: function(photoUrl, placeID) {
		var keyName = placeID + "photo";
		localStorage.setItem( keyName, photoUrl);
	},
	/**
	* @description generates stylized names for buttons from initial category array
	* @returns {array}  - Stylized Names for buttons
	*/
	makeButtonList: function() {
		var array = ['Top Picks'];
		for (var i = 0; i < categories.length; i++) {
			var capitalizedCategory = categories[i][0].toUpperCase() + categories[i].slice(1);
			array.push(capitalizedCategory);
		}
		return array;
	}
};
/**
* @description Google Map & Library API calls
*/
var MapFunc = {
	mapOptions: {
		center: {lat: 29.960, lng: -90.065},
    	zoom: 13,
    	disableDefaultUI: true
  	},
  	/**
	* @description Called on successful google map script load, initiates coordinates, map, service, and ONE infoWindow
	*/
	init: function () {
		this.coordinates = new google.maps.LatLng(29.960,-90.065);
		this.map = new google.maps.Map(document.querySelector('#map'), this.mapOptions);
		this.service = new google.maps.places.PlacesService(this.map);
		this.infoWindow = new google.maps.InfoWindow();
		this.bounds = new google.maps.LatLngBounds();
		window.addEventListener('resize', function(e) {
  			MapFunc.map.setCenter(MapFunc.coordinates);
  			MapFunc.map.fitBounds(MapFunc.bounds);
		});
	},
	/**
	* @description called when local storage for category doesn't exist
	* @param {string} placeName -  string to be sent to google, either from the array from foursquare or the hard coded Top List
	* @param {array} placeDataArray - array that will house new place objs
	* @param {string} category  -  e.g. foodLocalStorage
	*/
	getInitialData: function(placeName, placeDataArray, category) {
    	var request = {
    		location: this.coordinates,
    		radius: 1000,
    		query: placeName
    	};
		this.service.textSearch(request, function(results, status) {
			if (status == google.maps.places.PlacesServiceStatus.OK) {
				MapFunc.getGoogleDetails(results[0].place_id, placeDataArray, category);
	    	}
    	});
	},
	/**
	* @description takes place ID from first google api call and requests detailed info. Both saves it in local storage and uses it to initiate new place obj
	* @param {string} placeID
	* @param {array} placeDataArray
	* @param {string} category
	*/
	getGoogleDetails: function(placeID, placeDataArray, category) {
		MapFunc.service.getDetails({placeId: placeID}, function(results, status) { //callback as an anonymous function
			console.log("Result from google api request:" + status);
			if (status == google.maps.places.PlacesServiceStatus.OK) {
				placeDataArray.push( new Place(results));
				Model.saveInLocalStorage(results, category);
  			}
  			$('.my-btn').prop('disabled', true); //So requests to Google doesn't go over 10 query/second limit
			setTimeout(function(){
        		$('.my-btn').prop('disabled', false);
    		}, 3000);
		});
	},
	/**
	* @description Called by Place constructor, uses place properties to complete the info Window string
	* @param {obj} place -  the place obj
	*/
	setInfoWindowContent: function(place) {
		place.marker.infoWindowContent = " <img src='" + place.photoUrl + "' class='infowindow-image' alt='place photo'>" +  "<h4 class='info-title'>" + place.name + "</h4>" + "<p>" + place.phone + "</p>" + "<span class='rating'>" + place.rating() + "</span>"  +    "<a href='" + place.website + "'> " + (place.website || place.address) + "</a>" ; //stored as property of marker for easy referenec at call time
	}
  };
/**
* @description Constructs each place, sets marker, and makes a wiki api call
* @constructor
* @param {obj} placeData -  either the google obj or very similar localStorage obj from earlier load
*/
var Place = function(placeData) {
	this.placeID = placeData.place_id;
	this.name = placeData.name;
	this.address = placeData.formatted_address;
	this.location = placeData.geometry.location;
	this.lat = typeof placeData.geometry.location.lat === 'function' ? placeData.geometry.location.lat() : placeData.geometry.location.lat; // lat() functiion lost upon stringify; || to handle localStorage retreival
	this.lng = typeof placeData.geometry.location.lng ==='function' ? placeData.geometry.location.lng() : placeData.geometry.location.lng;
	this.rating = ko.observable(placeData.rating || 3.9);
	this.photoUrl = Model.getPhotoUrl(this, placeData.photos);
	this.typesArray = placeData.types;
	this.marker = new google.maps.Marker({
		position: placeData.geometry.location,
		map: MapFunc.map,
		animation: google.maps.Animation.DROP,
		icon: 'img/top_picks.png' //this is only the initial value
	});
	this.wikiURL = ko.observable(''); //either silently fails and remains an empty string, or changes upon wiki callback
	Model.getWikiUrl(this);
	this.reviewsArray = placeData.reviews;
	this.phone = placeData.formatted_phone_number || "703-555-1234";
	this.website = placeData.website;
	this.showReviews = ko.observable(false); //whether or not to display the reviews of this place

	MapFunc.setInfoWindowContent(this); //passes place obj to set infowindow content
	this.coordinates = new google.maps.LatLng(this.lat, this.lng); //new obj needed for localStorage case; otherwise this.location works
	MapFunc.bounds.extend(this.coordinates);
	MapFunc.map.fitBounds(MapFunc.bounds);

	google.maps.event.addListener(this.marker, 'click', function(e) {
		MapFunc.infoWindow.setContent(this.infoWindowContent);
		MapFunc.infoWindow.open(MapFunc.map, this);
		MapFunc.map.panTo(this.getPosition());
		this.setAnimation(google.maps.Animation.BOUNCE);
		setTimeout(function( marker ) {
			marker.setAnimation(null);
		}, 1400, this);
	});
};

/**
* @description The View Model
*/

var ViewModel = function() {
	var self = this;
	self.arrayOfArrays = ko.observableArray(); //the 'mother array' holding arrays of place data
	self.arrayOfArrays.push(Model.topPicksPlaceArray);

	self.currentList = ko.observableArray([]); //current array of places
	self.currentIndex = ko.observable(0); //subscribers : currentList & setMarkerIcon

	self.buttonArray = Model.makeButtonList();
	/**
	* @description Maintains current List as the desired array within the array of arrays
	*/
	self.copy = ko.computed(function(){
		self.currentList(self.arrayOfArrays()[self.currentIndex()]());
	});

	self.currentTitle = ko.observable('Top Picks'); //bound to span above place results

	self.currentFilter = ko.observable('');//bound to text Input

	self.categoryToShow = ko.observable(''); //bound to radio buttons: the selected category (from the additional filter categories )

	self.showFilter = ko.observable(false);//bound to checkbox

	/**
	* @description changes the current marker icon
	* @returns {string} - the file path to the current marker icon
	*/
	self.markerIcon = ko.computed(function() {
		return markerIconArray[self.currentIndex()];
	});
	/**
	* @description filters results
	* subscribes to: current Filter & categoryToShow
	* @returns {array} - array of filtered place results
	*/

	self.filteredPlaces = ko.computed(function() {
		var filter = self.currentFilter().toLowerCase();
		if(!filter && !self.categoryToShow()) {  //if there is nothing being typed in the filter AND no selcted category
			return self.currentList();
		} else if (filter) { //supercedes category section
			return ko.utils.arrayFilter(self.currentList(), function(place) {
				return place.name.toLowerCase().includes(filter);      //returns true when letters match
			});
		} else {
			return ko.utils.arrayFilter(self.currentList(), function(place) {
				return place.typesArray.indexOf(self.categoryToShow()) != -1;  //returns true when search category exists within types array
			});
		}
	});

	/**
	* @description Called on click of different Category Buttons
	* @param {string} index-  called in a foreach loop, the index of the button clicked
	*/
	self.setCurrentList = function(index) {
		$('.collapse').collapse('hide'); //hides dropdown navbar on click

		self.categoryToShow(''); //reset category filter
		self.currentFilter(''); //reset text filter value
		MapFunc.infoWindow.close();

		if(self.currentIndex() != index) {
			self.clearMarkers(); //clear markers of currentList BEFORE currentList changes
		}

		self.currentIndex(index);
		self.currentTitle (self.buttonArray[index]);//changes span above results

		if(this.length === 0) { //when the category's place array is empty

			var category = categories[index - 1];
			Model.getData(category, Model[category]()); //initiate google search
		}
		self.setMarkerIcon(); //changes markers of currentList AFTER change

		self.setBounds();
	};
	/**
	* @description Removes marker from maps
	*/
	self.clearMarkers = function() {
		self.currentList().forEach(function(place) {
			place.marker.setVisible(false);
		});
	};
	/**
	* @description Changes the marker icon based on currentIndex
	*/
	self.setMarkerIcon = function() {
		self.currentList().forEach(function(place) {
			place.marker.setIcon(self.markerIcon());
		});
	};
	/**
	* @description Computes markers to be displayed
	*/
	self.currentMarkers = ko.computed ( function() {
		self.clearMarkers();
		self.filteredPlaces().forEach(function(place) {
			place.marker.setVisible(true);
		});
	});
	/**
	* @description Resets bounds so map zooms on new markers
	*/
	self.setBounds = function() {
		MapFunc.bounds = new google.maps.LatLngBounds();
		self.currentList().forEach(function(place) {
			MapFunc.bounds.extend(place.coordinates);
		});
		MapFunc.map.fitBounds(MapFunc.bounds);
	};
	/**
	* @description On click of place Name, open InfoWindow
	*/
	self.setFocus = function() {
		var marker = this.marker; //this = place obj
		google.maps.event.trigger(marker, 'click');
	};
	/**
	* @description Generates the array bound to the additional filter categories
	* @returns {array}  -  unique category values to use as additional filters
	*/
	self.uniqueCategories = ko.computed(function(){
		var array = [];
		self.currentList().forEach(function(place){
			array = array.concat(place.typesArray); //a long array containing repeats of type categories
		});
		return ko.utils.arrayGetDistinctValues(array);
	});

	/**
	* @description Animation functions called by beforeRemove & afterRender listeners
	* @param {DOM element} element -  DOM element to animate (and remove)
	*/
	self.slideAway = function(element) {
		$(element).filter('li').slideUp(function() {
			$(element).remove();
		});
	};
	self.fade = function(element) {
		$(element).hide().fadeIn();
	};

	/**
	* @description Autocompletes input fields
	* @param {array} filteredNames -  an array of the place names of the current list
	*/
	$("#autocomplete").autocomplete({
	  	source: topPicks,
	  	select: function( event, ui) {
	  		self.currentFilter (ui.item.label);
	  	}
	});

	self.filteredNames = ko.computed(function() {
		var array = [];
		self.filteredPlaces().forEach(function(place){
			array.push(place.name);
		});
		$( "#autocomplete" ).autocomplete( "option", "source", array );
		return array;
	});
};
/**
* @description Custom binding (adapted from knockout animation example)
* @param {DOM element} element -  DOM element to animate (and remove)
* @param {boolean} valueAccessor -
*/
ko.bindingHandlers.fadeIn = {
    init: function(element, valueAccessor) {
        var value = valueAccessor();
        $(element).toggle(ko.unwrap(value));
    },
    update: function(element, valueAccessor) {
        var value = valueAccessor();//either slide down or slide Up based on value
        ko.unwrap(value) ? $(element).slideDown("slow") : $(element).slideUp();
    }
};

var vm = new ViewModel();
ko.applyBindings(vm);

function googleSuccess() {
    MapFunc.init();
    Model.init();
}

function googleFail() {
    alert("Computer says No! Google Maps didn't load properly. Try reloading the page in a little bit. Here's a picture of a kitten to make you feel better");
    $('#map').append('<img src="http://lorempixel.com/500/800/cats" style="height:100%;">');
}

$('#small-list').click(function() {
	$('.collapse').collapse('hide');
});
