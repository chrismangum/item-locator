
var app = angular.module('app', []);

app.controller('mainCtrl', ['$scope', '$httpBackend', '_', '$sce', 'locationService',
  function ($scope, $httpBackend, _, $sce, locationService) {
    $scope.locations = [];

    $scope.exitSearch = function () {
      $scope.searchAddress = '';
      $scope.searchMode = false;
      $scope.sortField = 'name';
    };

    $scope.getDistanceLabel = function(locations, i) {
      var string =  '',
        distance = _.find([500, 250, 100, 50, 20, 10, 5, 1], function (dist) {
        return (locations[i].distance >= dist && (i === 0 || locations[i - 1].distance < dist));
      });
      if (distance) {
        string = '<div class="label label-miles">' + distance + '+ Miles</div>';
      }
      return $sce.trustAsHtml(string);
    };

    /*$scope.activateLocation = function (i) {
      map.setCenter($scope.markers[i].position);
      openInfoWindow.call($scope.markers[i]);
    };*/

    $scope.$on('update', function () {
      $scope.locations = locationService.data;
      $scope.$apply();
    });

    $scope.$on('search', function () {
      $scope.locations = locationService.data;
      $scope.searchMode = true;
      $scope.sortField = 'distance';
      $scope.queryAddress = $scope.searchAddress;
      $scope.$apply();
    });

    locationService.init();
  }
]);

app.directive('map', ['locationService', 'googleMap', function (locationService, googleMap) {
  return {
    restrict: 'E',
    scope: {},
    template: '<div class="map-wrapper">' +
      '<div class="map" id="map-canvas"></div>' +
    '</div>',
    link: function(scope, el) {

      scope.locations = [];
      scope.markers = [];

      googleMap.init();

      function fitMapBounds() {
        var bounds = new google.maps.LatLngBounds();  
        _.each(scope.markers, function (marker) {
          bounds.extend(marker.position);
        });
        googleMap.map.fitBounds(bounds);
      }

      function genInfoHtml(loc) {
        var html = [
          '<div class="info-window">', 
          '<div class="basic-info">',
          '<div class="info-name">'
        ];
        if (loc.website !== '-') {
          if (loc.website.indexOf('http://') === -1) {
            loc.website = 'http://' + loc.website;
          }
          html.push('<a target="_blank" href="', loc.website, '">', loc.name,'</a>');
        } else {
          html.push(loc.name);
        }
        html.push('</div><div class="info-address1">', loc.address,'</div>',
            '<div class="info-address2">', loc.city, ', ', loc.state, ' ', loc.zip, '</div>',
          '</div>',
          '<div class="row-fluid more-info">',
            '<div class="span6">',
              '<div class="filter-info-wrapper">',
                '<div class="label">Phone</div>',
                '<div class="filter-info">', loc.phone, '</div>',
              '</div>',
            '</div>',
          '</div>',
        '</div>');
        return html.join('');
      }

      function openInfoWindow() {
        googleMap.infoWindow.setContent(genInfoHtml(scope.locations[this.index]));
        googleMap.infoWindow.open(googleMap.map, this);
      }
      function plotShops(data) {
        _.each(scope.locations, function (loc, i) {
          var marker = new google.maps.Marker({
            map: googleMap.map,
            position: new google.maps.LatLng(loc.lat, loc.lng),
            index: i
          });
          google.maps.event.addListener(marker, 'click', openInfoWindow);
          scope.markers[i] = marker;
        });
        fitMapBounds();
      }

      scope.$on('update', function () {
        scope.locations = locationService.data;
        plotShops();
      });

    }
  }
}]);

app.directive('locationSearch', ['locationService', '$rootScope', 'googleMap', function (locationService, $rootScope, googleMap) {
  return {
    restrict: 'E',
    scope: {
      searchAddress: '=',
    },
    template: '<div class="search-bar-wrapper">' +
      '<form id="location-search" ng-submit="locationSearch()">' +
        '<a href="#" class="search-bar-icon"><i class="icon-search"></i></a>' +
        '<input ng-model="searchAddress" autofocus placeholder="City, ST" type="text">' +
      '</form>' +
    '</div>',
    link: function (scope, el) {
      function calcDistances(searchPoint) {
        _.each(scope.locations, function (loc) {
          var dist = google.maps.geometry.spherical.computeDistanceBetween(
            searchPoint,
            new google.maps.LatLng(loc.lat, loc.lng)
          );
          dist *= 0.000621371; //convert meters to miles
          loc.distance = parseFloat(dist.toFixed());
        });
      }

      scope.locationSearch = function () {
        var geocoder = new google.maps.Geocoder();
        geocoder.geocode({'address': scope.searchAddress}, function (results, status) {
          var lat, lng, result;
          if (results.length) {
            result = results[0].geometry;
            googleMap.map.fitBounds(result.bounds);
            calcDistances(result.location);
            locationService.updateData(scope.locations)
            $rootScope.$broadcast('search');
          }
        });
      };
      scope.$on('update', function () {
        scope.locations = locationService.data;
      });
    }
  }
}]);

app.factory('googleMap', function () {
  return {
    initialized: false,
    init: function () {
      if (!this.initialized) {
        this.infoWindow = new google.maps.InfoWindow();
        this.map = new google.maps.Map(document.getElementById('map-canvas'), {
          zoom: 5,
          center: new google.maps.LatLng(39.8282, -98.5795),
        });
      }
    }
  }
});

app.factory('locationService', ['$httpBackend', '$rootScope', function ($httpBackend, $rootScope) {
  var originalData = [];
  return {
    initialized: false,
    data: [],
    resetData: function(data) {
      this.data = originalData;
      $rootScope.$broadcast('update');
    },
    updateData: function(data, broadcast) {
      this.data = data;
      if (broadcast) {
        $rootScope.$broadcast('update');
      }
    },
    init: function () {
      var that = this;
      if (!this.initialized) {
        $httpBackend('GET', 'clients.json', null, function (status, data) {
          var parsed;
          if (status === 200) {
            parsed = angular.fromJson(data);
            originalData = parsed;
            that.data = parsed;
            $rootScope.$broadcast('update');
          } else {
            console.log('Problem getting data');
          }
        });
      }
    }
  };
}]);

app.factory('_', function () {
  return _;
});
