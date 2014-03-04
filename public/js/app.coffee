app = angular.module 'app', []

app.controller 'mainCtrl', ['$scope', '$http', '$sce'
  ($scope, $http, $sce) ->
    geocoder = new google.maps.Geocoder()

    $scope.data = null
    $scope.filteredData = null
    $scope.sortField = 'name'
    $scope.activeItem = null
    $scope.activateItemCallback = ->

    $scope.$on 'activateItem', (e, index) ->
      $scope.activeItem = $scope.data[index]
      $scope.$apply()
      $scope.activateItemCallback()
      
    $scope.$on 'activateItemCallback', (e, callback) ->
      $scope.activateItemCallback = callback

    $scope.$on 'deactivateItem', ->
      $scope.activeItem = null
      $scope.$apply()

    $scope.$on 'unGroup', ->
      $scope.sortField = 'name'

    $scope.getLabel = (locations, i) ->
      string =  ''
      distance = _.find [500, 250, 100, 50, 20, 10, 5, 1], (dist) ->
        locations[i].distance >= dist and (i == 0 or locations[i - 1].distance < dist)
      if distance
        string = '<div class="label label-miles">' + distance + '+ Miles</div>'
      $sce.trustAsHtml string

    calcDistances = (searchPoint) ->
      _.each $scope.data, (loc) ->
        dist = google.maps.geometry.spherical.computeDistanceBetween searchPoint, new google.maps.LatLng loc.lat, loc.lng
        dist *= 0.000621371; #convert meters to miles
        loc.distance = parseFloat dist.toFixed()

    $scope.locationSearch = () ->
      geocoder.geocode 'address': $scope.searchAddress, (results, status) ->
        if results.length
          result = results[0]
          $scope.map.fitBounds result.geometry.bounds
          calcDistances result.geometry.location
          $scope.filteredData = $scope.data
          $scope.sortField = 'distance'
          $scope.groupLabel = 'Distance from "' + result.formatted_address + '"'
          $scope.$apply()
          
    $http.get('clients.json').then (response) ->
      data = response.data
      $scope.data = angular.fromJson data
      $scope.filteredData = $scope.data
]

app.directive 'activateItem', () ->
  (scope, el, attrs) ->
    el.on 'click', () ->
      scope.$emit 'activateItem', attrs.activateItem

app.directive 'infoWindow', () ->
  restrict: 'E'
  templateUrl: 'info-window.html'

app.directive 'list', ['$filter', ($filter) ->
  restrict: 'E'
  transclude: true
  scope:
    groupLabel: '='
    data: '&'
    filteredData: '='
    sortField: '&'
    activeItem: '&'
    getLabel: '&'
  replace: true
  templateUrl: 'list.html'
  link: (scope) ->
    scope.$watch (() -> scope.activeItem()), (newItem, oldItem) ->
      if oldItem != newItem
        if oldItem
          oldItem.name = oldItem.name.replace '*', ''
        if newItem
          newItem.name += '*'

    scope.$watch 'searchValue', (newVal, oldVal) ->
      if newVal != oldVal
        if newVal
          scope.filteredData = $filter('filter') scope.data(), name: newVal
        else
          scope.filteredData = scope.data()

    scope.unGroup = () ->
      scope.groupLabel = ''
      scope.$emit 'unGroup'
]

app.directive 'map', ['$compile', ($compile) ->
  restrict: 'E'
  replace: true
  scope:
    map: '='
    data: '&'
    activeItem: '&'
  template: '<div class="map-wrapper">' +
    '<div class="map" id="map-canvas"></div>' +
  '</div>'
  link: (scope, el) ->
    pinClick = false
    markers = []
    infoWindow = new google.maps.InfoWindow()
    infoWindowTemplate = $compile('<info-window></info-window>') scope

    scope.map = new google.maps.Map el.find('#map-canvas')[0],
      zoom: 5
      center: new google.maps.LatLng 39.8282, -98.5795
      
    google.maps.event.addListener infoWindow, 'closeclick', () ->
      scope.$emit 'deactivateItem'

    fitMapBounds = () ->
      bounds = new google.maps.LatLngBounds()
      _.each markers, (marker) ->
        bounds.extend marker.position
      scope.map.fitBounds bounds

    plotShops = () ->
      _.each scope.data(), (loc, i) ->
        marker = new google.maps.Marker
          map: scope.map
          position: new google.maps.LatLng(loc.lat, loc.lng)
          index: i
        google.maps.event.addListener marker, 'click', () ->
          pinClick = true
          scope.$emit 'activateItem', this.index
          pinClick = false
        markers[i] = marker

    filterMarkers = () ->
      indexes = _.indexBy scope.data(), 'index'
      _.each markers, (item, i) ->
        item.setVisible !!indexes[i]

    scope.$watch (() -> scope.activeItem()), (item) ->
      if item
        unless pinClick
          scope.map.setCenter markers[item.index].position
        infoWindow.open scope.map, markers[item.index]

    scope.$emit 'activateItemCallback', () ->
      infoWindow.setContent infoWindowTemplate[0].innerHTML

    scope.$watch (() -> scope.data()), (newData, oldData) ->
      if newData
        #when data first loads:
        if oldData == null
          plotShops()
          fitMapBounds()
        else
          filterMarkers()
]
