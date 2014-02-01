
var app = angular.module('app', []);

app.controller('mainCtrl', ['$scope', 'locationService',
  function ($scope, locationService) {
    //variables accessable to all child directives
    $scope.data = null;

    $scope.groupedData = {};
    $scope.groupKeys = null;
    $scope.groupLabel = '+ Miles';

    $scope.activeItem = null;

    $scope.map = new google.maps.Map(document.getElementById('map-canvas'), {
      zoom: 5,
      center: new google.maps.LatLng(39.8282, -98.5795),
    });

    $scope.deactivateItem = function () {
      $scope.activeItem = null;
    };
    $scope.activateItem = function (i) {
      $scope.activeItem = $scope.data[i];
      $scope.$apply();
      $scope.activateItemCallback();
    };
    $scope.activateItemCallback = function () {};

    function sortByKey(arr, key, desc) {
      var direction = desc ? -1 : 1;
      return arr.sort(function (a, b) {
        var result = a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0;
        return result * direction;
      });
    }
    function getGroupedData(arr) {
      var tempArr = _.clone(arr);
      sortByKey(tempArr, 'distance');
      _.each(tempArr, function (loc) {
        var distance = _.find([500, 250, 100, 50, 20, 10, 5, 1], function (dist) {
          return loc.distance >= dist;
        });
        loc.group = distance;
      });
      return _.groupBy(tempArr, 'group');
    }
    function getGroupKeys (obj) {
      return _.map(_.keys(obj), function (item) {
        return parseInt(item);
      }).sort(function (a, b) {
        return a - b;
      });
    }

    $scope.$watch('searchPoint', function (point) {
      if (point) {
        _.each($scope.data, function (loc) {
          var dist = google.maps.geometry.spherical.computeDistanceBetween(
            $scope.searchPoint,
            new google.maps.LatLng(loc.lat, loc.lng)
          );
          dist *= 0.000621371; //convert meters to miles
          loc.distance = parseFloat(dist.toFixed());
        });
        $scope.groupedData = getGroupedData($scope.data);
        $scope.groupKeys = getGroupKeys($scope.groupedData);
        $scope.queryAddress = $scope.searchAddress;
      }
    });

    locationService.init(function (data) {
      $scope.data = data;
      $scope.groupedData = data;
      $scope.$apply();
    });
  }
]);

app.directive('activateItem', function () {
  return function (scope, el, attrs) {
    el.on('click', function() {
      scope.activateItem(attrs.activateItem);
    });
  }
});

app.directive('infoWindow', function () {
  return {
    restrict: 'E',
    templateUrl: 'info-window.html'
  }
});

app.directive('map', ['$compile', function ($compile) {
  return {
    restrict: 'E',
    replace: true,
    template: '<div class="map-wrapper">' +
      '<div class="map" id="map-canvas"></div>' +
    '</div>',
    link: function(scope, el) {
      var pinClick,
        markers = [],
        infoWindow = new google.maps.InfoWindow(),
        infoWindowTemplate = $compile('<info-window></info-window>')(scope);

      google.maps.event.addListener(infoWindow, 'closeclick', function () {
        scope.deactivateItem();
        scope.$apply();
      });

      function fitMapBounds() {
        var bounds = new google.maps.LatLngBounds();  
        _.each(markers, function (marker) {
          bounds.extend(marker.position);
        });
        scope.map.fitBounds(bounds);
      }

      function plotShops() {
        _.each(scope.data, function (loc, i) {
          var marker = new google.maps.Marker({
            map: scope.map,
            position: new google.maps.LatLng(loc.lat, loc.lng),
            index: i
          });
          google.maps.event.addListener(marker, 'click', function () {
            pinClick = true;
            scope.activateItem(this.index);
            scope.$apply();
            pinClick = false;
          });
          markers[i] = marker;
        });
      }

      scope.$watch('activeItem', function (item) {
        if (item) {
          if (!pinClick) {
            scope.map.setCenter(markers[item.index].position);
          }
          infoWindow.open(scope.map, markers[item.index]);
        }
      });

      scope.activateItemCallback = function() {
        infoWindow.setContent(infoWindowTemplate[0].innerHTML);
      };

      scope.$watch('data', function (newData, oldData) {
        plotShops();
        //data is only null at page load, so fit map bounds:
        if (oldData === null) {
          fitMapBounds();
        }
      });
    }
  }
}]);

app.directive('locationSearch', function () {
  return {
    restrict: 'E',
    replace: true,
    template: '<div class="search-bar-wrapper">' +
      '<form id="location-search" ng-submit="locationSearch()">' +
        '<a href="#" class="search-bar-icon"><i class="icon-search"></i></a>' +
        '<input ng-model="searchAddress" autofocus placeholder="City, ST" type="text">' +
      '</form>' +
    '</div>',
    link: function (scope, el) {
      scope.locationSearch = function () {
        var geocoder = new google.maps.Geocoder();
        geocoder.geocode({'address': scope.searchAddress}, function (results, status) {
          var lat, lng, result;
          if (results.length) {
            result = results[0].geometry;
            scope.map.fitBounds(result.bounds);
            scope.searchPoint = result.location;
            scope.$apply();
          }
        });
      };
    }
  }
});

app.directive('list', function () {
  return {
    restrict: 'E', 
    transclude: true,
    replace: true,
    templateUrl: 'list.html',
    link: function (scope) {
      scope.isArray = _.isArray;

      scope.$watch('activeItem', function (newItem, oldItem) {
        if (oldItem !== newItem) {
          if (oldItem) {
            oldItem.name = oldItem.name.replace('*', '');
          }
          if (newItem) {
            newItem.name += '*';
          }
        }
      });

      scope.exitSearch = function () {
        scope.searchAddress = '';
        scope.groupedData = scope.data;
      };
    }
  };
});

app.factory('locationService', ['$httpBackend',
  function ($httpBackend) {
    return {
      initialized: false,
      data: [],
      init: function (callback) {
        var that = this;
        if (!this.initialized) {
          $httpBackend('GET', 'clients.json', null, function (status, data) {
            var parsed;
            if (status === 200) {
              parsed = angular.fromJson(data);
              originalData = parsed;
              that.data = parsed;
              callback(that.data);
            } else {
              console.log('Problem getting data');
            }
          });
        } else {
          callback(this.data);
        }
      }
    };
  }
]);

app.factory('_', function () {
  return _;
});

