
var app = angular.module('app', []);

app.controller('mainCtrl', ['$scope', '$httpBackend', '_', function ($scope, $httpBackend, _) {
  $scope.locations = [];
  $scope.markers = [];

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

  function plotShops(data) {
    _.each($scope.locations, function (loc, i) {
      var marker = new google.maps.Marker({
        map: map,
        position: new google.maps.LatLng(loc.lat, loc.lng),
        index: i
      });
      //google.maps.event.addListener(marker, 'click', open_info_window);
      $scope.markers[i] = marker;
    });
    fitMapBounds();
  }

  $httpBackend('GET', 'clients.json', null, function (status, data) {
    $scope.locations = angular.fromJson(data);
    plotShops();
    $scope.$apply();
  });
}]);

app.factory('_', function () {
  return _;
});
