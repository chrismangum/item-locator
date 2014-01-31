
var app = angular.module('app', []);

app.controller('mainCtrl', ['$scope', '$httpBackend', '_', '$sce', 'locationService',
  function ($scope, $httpBackend, _, $sce, locationService) {
    $scope.locations = [];
    $scope.markers = [];
    $scope.searchMode = false;
    $scope.sortField = 'name';

    var infoWindow = new google.maps.InfoWindow();
    var map = new google.maps.Map(document.getElementById('map-canvas'), {
      zoom: 5,
      center: new google.maps.LatLng(39.8282, -98.5795),
    });

    function fitMapBounds() {
      var bounds = new google.maps.LatLngBounds();  
      _.each($scope.markers, function (marker) {
        bounds.extend(marker.position);
      });
      map.fitBounds(bounds);
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
      infoWindow.setContent(genInfoHtml($scope.locations[this.index]));
      infoWindow.open(map, this);
    }

    function plotShops(data) {
      _.each($scope.locations, function (loc, i) {
        var marker = new google.maps.Marker({
          map: map,
          position: new google.maps.LatLng(loc.lat, loc.lng),
          index: i
        });
        google.maps.event.addListener(marker, 'click', openInfoWindow);
        $scope.markers[i] = marker;
      });
      fitMapBounds();
    }
    function calcDistances(searchPoint) {
      _.each($scope.locations, function (loc, i) {
        var dist = google.maps.geometry.spherical.computeDistanceBetween(
          searchPoint,
          new google.maps.LatLng(loc.lat, loc.lng)
        );
        dist *= 0.000621371; //convert meters to miles
        loc.distance = parseFloat(dist.toFixed());
      });
    }

    $scope.exitSearch = function () {
      $scope.searchAddress = '';
      $scope.searchMode = false;
      $scope.sortField = 'name';
    };

    $scope.locationSearch = function () {
      var geocoder = new google.maps.Geocoder();
      geocoder.geocode({'address': $scope.searchAddress}, function (results, status) {
        var lat, lng, result;
        if (results.length) {
          result = results[0].geometry;
          map.fitBounds(result.bounds);
          calcDistances(result.location);
          $scope.searchMode = true;
          $scope.sortField = 'distance';
          $scope.queryAddress = $scope.searchAddress;
          $scope.$apply();
        }
      });
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

    $scope.activateLocation = function (i) {
      map.setCenter($scope.markers[i].position);
      openInfoWindow.call($scope.markers[i]);
    };

    $scope.$on('update', function () {
      $scope.locations = locationService.data;
      plotShops();
      $scope.$apply();
    });

    locationService.init();

  }
]);

app.factory('locationService', ['$httpBackend', '$rootScope', function ($httpBackend, $rootScope) {
  var originalData = [];
  return {
    initialized: false,
    data: [],
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
