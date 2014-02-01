
var app = angular.module('app', []);

app.controller('mainCtrl', ['$scope', '$httpBackend', '$filter', 'groupByDistance',
  function ($scope, $httpBackend, $filter, groupByDistance) {
    var pristineData = null;
    $scope.queryAddress;

    $scope.data = null;
    $scope.filteredData = null;
    $scope.clearGroups = function () {
      $scope.data = [{
        data: _.clone(pristineData)
      }];
    };

    $scope.activeItem = null;

    $scope.map = new google.maps.Map(document.getElementById('map-canvas'), {
      zoom: 5,
      center: new google.maps.LatLng(39.8282, -98.5795),
    });

    $scope.deactivateItem = function () {
      $scope.activeItem = null;
    };

    $scope.activateItem = function (index) {
      $scope.activeItem = pristineData[index];
      $scope.$apply();
      $scope.activateItemCallback();
    };
    $scope.activateItemCallback = function () {};

    $scope.$on('activateItem', function (e, index) {
      $scope.activateItem(index);
    });

    $scope.$on('ungroup', function () {
      $scope.groupLabel = '';
      $scope.clearGroups();
      $scope.filteredData = $scope.data;
    });

    $scope.$on('searchResult', function (e, result) {
      $scope.clearGroups();
      $scope.map.fitBounds(result.geometry.bounds);
      $scope.data = groupByDistance($scope.data[0].data, result.geometry.location);
      $scope.filteredData = $scope.data;
      $scope.groupLabel = 'Distance from "' + result.formatted_address + '"';
      $scope.$apply();
    });

    $httpBackend('GET', 'clients.json', null, function (status, data) {
      if (status === 200) {
        pristineData = angular.fromJson(data);
        $scope.clearGroups();
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

app.directive('list', function ($filter) {
  return {
    restrict: 'E', 
    transclude: true,
    scope: {
      groupLabel: '=',
      data: '=',
      filteredData: '=',
      activeItem: '='
    },
    replace: true,
    templateUrl: 'list.html',
    link: function (scope) {

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

      scope.$watch('searchValue', function (newVal, oldVal) {
        if (newVal !== oldVal) {
          if (newVal) {
            scope.filteredData = [];
            _.each(scope.data, function (group) {
              var results = $filter('filter')(group.data, {name: newVal});
              if (results.length) {
                results = {data: results};
                if (group.name) {
                  results.name = group.name;
                }
                scope.filteredData.push(results);
              }
            });
          } else {
            scope.filteredData = scope.data;
          }
        }
      });

      scope.unGroup = function () {
        scope.$emit('ungroup');
      };
    }
  };
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
        _.each(scope.data[0].data, function (loc, i) {
          var marker = new google.maps.Marker({
            map: scope.map,
            position: new google.maps.LatLng(loc.lat, loc.lng),
            index: i
          });
          google.maps.event.addListener(marker, 'click', function () {
            pinClick = true;
            scope.activateItem(this.index);
            pinClick = false;
          });
          markers[i] = marker;
        });
      }

      function filterMarkers() {
        var items = _.flatten(_.map(scope.filteredData, function (item) {
          return item.data;
        }));
        _.each(markers, function (item) {
          item.setVisible(false);
        });
        _.each(items, function (item) {
          markers[item.index].setVisible(true);
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

      scope.$watch('filteredData', function (newData, oldData) {
        if (newData) {
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


app.factory('groupByDistance', function () {
  function sortByKey(arr, key, desc) {
    var direction = desc ? -1 : 1;
    return arr.sort(function (a, b) {
      var result = a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0;
      return result * direction;
    });
  }

  function calculateDistances(arr, point) {
    _.each(arr, function (item) {
      item.distance = calculateDistance(item, point);
    });
    sortByKey(arr, 'distance');
    return arr;
  }

  function addGroups(arr) {
    _.each(arr, function (loc) {
      var distance = _.find([500, 250, 100, 50, 20, 10, 5, 1], function (dist) {
        return loc.distance >= dist;
      });
      loc.group = distance + '+ Miles';
    });
    return arr;
  }

  function getGroupedData(arr) {
    var data = {},
    arr = addGroups(arr);
    data = _.groupBy(arr, 'group');
    return _.map(getSortedGroupKeys(data), function (key) {
      return {
        name: key,
        data: data[key]
      };
    });
  }
  function getSortedGroupKeys(obj) {
    return _.keys(obj).sort(function (a, b) {
      return parseInt(a) - parseInt(b);
    });
  }

  function calculateDistance(loc, point) {
    var dist = google.maps.geometry.spherical.computeDistanceBetween(
      point,
      new google.maps.LatLng(loc.lat, loc.lng)
    );
    dist *= 0.000621371; //convert meters to miles
    return parseFloat(dist.toFixed());
  }
  return function (data, searchPoint) {
    return getGroupedData(calculateDistances(data, searchPoint));
  };
});
