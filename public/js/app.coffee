app = angular.module 'app', []

app.controller 'mainCtrl', ['$scope', '$sce', '$map', '$locations'
  ($scope, $sce, $map, $locations) ->

    $scope.locations = $locations
    $scope.sortField = 'name'

    $scope.getLabel = (locations, i) ->
      distance = _.find [500, 250, 100, 50, 20, 10, 5, 1], (dist) ->
        locations[i].distance >= dist and (not i or locations[i - 1].distance < dist)
      if distance
        string = "<div class='label label-miles'>#{distance}+ Miles</div>"
      $sce.trustAsHtml string

    calcDistances = (searchPoint) ->
      _.each $locations.data, (loc) ->
        loc.distance = $map.calcDistance searchPoint, $map.genLatLng loc.lat, loc.lng

    $scope.locationSearch = ->
      $map.locationSearch $scope.searchAddress, (result) ->
        $locations.unfilterData()
        calcDistances result.geometry.location
        $scope.sortField = 'distance'
        $scope.groupLabel = "Distance from \"#{result.formatted_address}\""
          
    $locations.get 'clients.json'
]

app.directive 'activateItem', ->
  (scope, el, attrs) ->
    el.on 'click', ->
      scope.locations.activateItem attrs.activateItem

app.directive 'infoWindow', ->
  restrict: 'E'
  templateUrl: 'info-window.html'

app.directive 'list', ['$filter', ($filter) ->
  restrict: 'E'
  transclude: true
  scope:
    getLabel: '&'
    groupLabel: '='
    locations: '='
    sortField: '='
  replace: true
  templateUrl: 'list.html'
  link: (scope) ->
    originalSort = scope.sortField

    scope.$watch 'searchValue', (newVal, oldVal) ->
      if newVal isnt oldVal
        scope.locations.filterData name: newVal

    scope.unGroup = ->
      scope.groupLabel = ''
      scope.sortField = originalSort
]

app.directive 'map', ['$compile', '$map', ($compile, $map) ->
  restrict: 'E'
  replace: true
  scope:
    locations: '='
  template: '<div class="map-wrapper">
    <div class="map" id="map-canvas"></div>
  </div>'
  link: (scope, element) ->
    pinClick = false
    infoWindow = new google.maps.InfoWindow()
    infoWindowTemplate = $compile('<info-window></info-window>') scope

    $map.init element.children()[0]
      
    $map.on 'closeclick', infoWindow, ->
      scope.locations.deactivateItem true

    scope.$watch 'locations.activeItem', (item) ->
      if item
        unless pinClick
          $map.center $map.markers[item.index].position
        infoWindow.open $map.map, $map.markers[item.index]

    filterMarkers = (data) ->
      indexes = _.indexBy data, 'index'
      _.each $map.markers, (item, i) ->
        item.setVisible i of indexes

    scope.locations.activateItemCallback = ->
      infoWindow.setContent infoWindowTemplate[0].innerHTML

    scope.$watch 'locations.data', (newData, oldData) ->
      if newData
        if oldData
          filterMarkers newData
        else
          $map.genMarkers newData, ->
            pinClick = true
            scope.locations.activateItem @index
            pinClick = false
]

app.factory '$locations', ['$rootScope', '$http', '$filter'
  ($rootScope, $http, $filter) ->

    activateItem: (index) ->
      @deactivateItem()
      @activeItem = @data[index]
      @activeItem.isActive = true
      $rootScope.$apply()
      @activateItemCallback?()

    deactivateItem: (apply) ->
      @activeItem?.isActive = false
      @activeItem = null
      $rootScope.$apply() if apply

    filterData: (filterVal) ->
      @data = $filter('filter') @_pristineData, filterVal

    get: (url) ->
      $http.get(url).then (response) =>
        @_pristineData = response.data
        @unfilterData()

    unfilterData: ->
      @data = @_pristineData
]

app.factory '$map', ['$rootScope', ($rootScope) ->

  geocoder = new google.maps.Geocoder()
  genMarkerBounds = (markers) ->
    bounds = new google.maps.LatLngBounds()
    _.each markers, (marker) ->
      bounds.extend marker.position
    bounds

  calcDistance: (start, end) ->
    dist = google.maps.geometry.spherical.computeDistanceBetween start, end
    Math.round dist * 0.000621371 #convert meters to miles and round

  center: (point) ->
    @map.setCenter point

  fit: (bounds) ->
    @map.fitBounds bounds

  genLatLng: (lat, lng) ->
    new google.maps.LatLng lat, lng

  genMarkers: (data, eventHandler) ->
    @markers = _.map data, (loc, i) =>
      marker = new google.maps.Marker
        map: @map
        position: @genLatLng loc.lat, loc.lng
        index: i
      @on 'click', marker, eventHandler
      marker
    @fit genMarkerBounds @markers

  init: (element) ->
    @map = new google.maps.Map element,
      zoom: 5
      center: @genLatLng 39.8282, -98.5795

  locationSearch: (address, callback) ->
    geocoder.geocode 'address': address, (results, status) =>
      if results.length
        result = results[0]
        @fit result.geometry.bounds
        callback result
        $rootScope.$apply()

  on: (event, context, callback) ->
    google.maps.event.addListener context, event, callback
]
