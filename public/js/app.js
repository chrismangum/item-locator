
var app = angular.module('app', []);

app.controller('mainCtrl', ['$scope', '$httpBackend',
  function ($scope, $httpBackend) {
    $scope.map = new google.maps.Map(document.getElementById('map-canvas'), {
      zoom: 5,
      center: new google.maps.LatLng(39.8282, -98.5795),
    });

    $scope.data = null;
    $scope.filteredData = null;
    $scope.sortField = 'name';
    $scope.activeItem = null;

    $scope.activateItemCallback = function () {};

    $scope.$on('activateItem', function (e, index) {
      $scope.activeItem = $scope.data[index];
      $scope.$apply();
      $scope.activateItemCallback();
    });

    $scope.$on('activateItemCallback', function (e, callback) {
      $scope.activateItemCallback = callback;
    });

    $scope.$on('deactivateItem', function (e, index) {
      $scope.activeItem = null;
      $scope.$apply();
    });

    $scope.$on('unGroup', function () {
      $scope.sortField = 'name';
    });

    function calcDistances(searchPoint) {
      _.each($scope.data, function (loc, i) {
        var dist = google.maps.geometry.spherical.computeDistanceBetween(
          searchPoint,
          new google.maps.LatLng(loc.lat, loc.lng)
        );
        dist *= 0.000621371; //convert meters to miles
        loc.distance = parseFloat(dist.toFixed());
      });
    }

    $scope.$on('searchResult', function (e, result) {
      $scope.map.fitBounds(result.geometry.bounds);
      calcDistances(result.geometry.location);
      $scope.filteredData = $scope.data;
      $scope.sortField = 'distance';
      $scope.groupLabel = 'Distance from "' + result.formatted_address + '"';
      $scope.$apply();
    });

    $httpBackend('GET', 'clients.json', null, function (status, data) {
      if (status === 200) {
        $scope.data = angular.fromJson(data);
        $scope.filteredData = $scope.data;
        $scope.$apply();
      } else {
        console.log('Problem getting data');
      }
    });
  }
]);

app.directive('activateItem', function () {
  return function (scope, el, attrs) {
    el.on('click', function() {
      scope.$emit('activateItem', attrs.activateItem);
    });
  }
});

app.directive('infoWindow', function () {
  return {
    restrict: 'E',
    templateUrl: 'info-window.html'
  }
});

app.directive('list', ['$filter', '$sce', function ($filter, $sce) {
  return {
    restrict: 'E', 
    transclude: true,
    scope: {
      groupLabel: '=',
      data: '&',
      filteredData: '=',
      sortField: '&',
      activeItem: '&'
    },
    replace: true,
    templateUrl: 'list.html',
    link: function (scope) {
      scope.$watch(function () {
        return scope.activeItem();
      }, function (newItem, oldItem) {
        if (oldItem !== newItem) {
          if (oldItem) {
            oldItem.name = oldItem.name.replace('*', '');
          }
          if (newItem) {
            newItem.name += '*';
          }
        }
      });

      scope.$watch('searchValue', function (newVal, oldVal) {
        if (newVal !== oldVal) {
          if (newVal) {
            scope.filteredData = $filter('filter')(scope.data(), {name: newVal});
          } else {
            scope.filteredData = scope.data();
          }
        }
      });

      scope.unGroup = function () {
        scope.groupLabel = '';
        scope.$emit('unGroup');
      };

      scope.getLabel = function(locations, i) {
        var string =  '',
          distance = _.find([500, 250, 100, 50, 20, 10, 5, 1], function (dist) {
          return (locations[i].distance >= dist && (i === 0 || locations[i - 1].distance < dist));
        });
        if (distance) {
          string = '<div class="label label-miles">' + distance + '+ Miles</div>';
        }
        return $sce.trustAsHtml(string);
      };
    }
  };
}]);

app.directive('map', ['$compile', function ($compile) {
  return {
    restrict: 'E',
    replace: true,
    scope: {
      map: '&',
      data: '&',
      activeItem: '&'
    },
    template: '<div class="map-wrapper">' +
      '<div class="map" id="map-canvas"></div>' +
    '</div>',
    link: function(scope, el) {
      var pinClick,
        markers = [],
        infoWindow = new google.maps.InfoWindow(),
        infoWindowTemplate = $compile('<info-window></info-window>')(scope);
        
      scope.map = scope.map();

      google.maps.event.addListener(infoWindow, 'closeclick', function () {
        scope.$emit('deactivateItem');
      });

      function fitMapBounds() {
        var bounds = new google.maps.LatLngBounds();  
        _.each(markers, function (marker) {
          bounds.extend(marker.position);
        });
        scope.map.fitBounds(bounds);
      }

      function plotShops() {
        _.each(scope.data(), function (loc, i) {
          var marker = new google.maps.Marker({
            map: scope.map,
            position: new google.maps.LatLng(loc.lat, loc.lng),
            index: i
          });
          google.maps.event.addListener(marker, 'click', function () {
            pinClick = true;
            scope.$emit('activateItem', this.index);
            pinClick = false;
          });
          markers[i] = marker;
        });
      }

      function filterMarkers() {
        _.each(markers, function (item) {
          item.setVisible(false);
        });
        _.each(scope.data(), function (item) {
          markers[item.index].setVisible(true);
        });
      }

      scope.$watch(function () {
        return scope.activeItem();
      }, function (item) {
        if (item) {
          if (!pinClick) {
            scope.map.setCenter(markers[item.index].position);
          }
          infoWindow.open(scope.map, markers[item.index]);
        }
      });

      scope.$emit('activateItemCallback', function() {
        infoWindow.setContent(infoWindowTemplate[0].innerHTML);
      });

      scope.$watch(function () {
        return scope.data();
      }, function (newData, oldData) {
        if (newData) {
          //when data first loads:
          if (oldData === null) {
            plotShops();
            fitMapBounds();
          } else {
            filterMarkers();
          }
        }
      });
    }
  }
}]);

app.directive('locationSearch', function () {
  return {
    restrict: 'E',
    replace: true,
    scope: {},
    template: '<div class="search-bar-wrapper">' +
      '<form id="location-search" ng-submit="locationSearch()">' +
        '<a href="#" class="search-bar-icon"><i class="icon-search"></i></a>' +
        '<input ng-model="searchAddress" autofocus placeholder="City, ST" type="text">' +
      '</form>' +
    '</div>',
    link: function (scope, el) {
      var geocoder = new google.maps.Geocoder();
      scope.locationSearch = function () {
        geocoder.geocode({'address': scope.searchAddress}, function (results, status) {
          if (results.length) {
            scope.$emit('searchResult', results[0]);
          }
        });
      };
    }
  }
});
