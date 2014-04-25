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
      for loc in $locations.data
        loc.distance = $map.map.calcDistance searchPoint, $map.genLatLng loc.lat, loc.lng

    $scope.locationSearch = ->
      if $scope.searchAddress
        $map.locationSearch $scope.searchAddress, (result) ->
          $locations.unfilterData()
          calcDistances result.geometry.location
          $scope.sortField = 'distance'
          $scope.groupLabel = "Distance from \"#{result.formatted_address}\""
      else
        $scope.sortField = 'name'
        $scope.groupLabel = ''

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

app.directive 'map', ['$map', '$compile', ($map, $compile) ->
  restrict: 'E'
  replace: true
  scope:
    locations: '='
  template: '<div class="map-wrapper">
    <div class="map" id="map-canvas"></div>
  </div>'
  link: (scope, element, attrs) ->
    pinClick = false

    $map.init element.children()[0], attrs.lat, attrs.lng
    infoWindow = new InfoWindow $compile('<info-window></info-window>')(scope)[0], $map.map

    $map.map.on 'closeclick', infoWindow, ->
      scope.locations.deactivateItem true

    scope.$watch 'locations.activeItem', (item) ->
      if item
        unless pinClick
          $map.map.setCenter $map.markers[item.index].position
        infoWindow.show $map.markers[item.index]

    filterMarkers = (data) ->
      indexes = _.indexBy data, 'index'
      for marker, i in $map.markers
        marker.setVisible i of indexes

    scope.locations.activateItemCallback = ->
      infoWindow.update()

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

class InfoWindow extends google.maps.InfoWindow
  constructor: (@_template, @_map) ->

  show: (context) ->
    @open @_map, context

  update: ->
    @setContent @_template.innerHTML

class Map extends google.maps.Map
  calcDistance: (start, end) ->
    dist = google.maps.geometry.spherical.computeDistanceBetween start, end
    Math.round dist * 0.000621371 #convert meters to miles and round

  fit: (bounds) ->
    @fitBounds bounds

  on: (event, context, callback) ->
    google.maps.event.addListener context, event, callback


app.factory '$locations', ['$rootScope', '$http', '$filter'
  ($rootScope, $http, $filter) ->

    activateItem: (index) ->
      @deactivateItem()
      @activeItem = @_pristineData[index]
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

app.factory '$map', ['$rootScope', '$compile', ($rootScope, $compile) ->

  geocoder = new google.maps.Geocoder()
  genMarkerBounds = (markers) ->
    bounds = new google.maps.LatLngBounds()
    for marker in markers
      bounds.extend marker.position
    bounds

  genLatLng: (lat, lng) ->
    new google.maps.LatLng lat, lng

  genMarkers: (data, eventHandler) ->
    @markers = _.map data, (loc, i) =>
      marker = new google.maps.Marker
        map: @map
        position: @genLatLng loc.lat, loc.lng
        index: i
      @map.on 'click', marker, eventHandler
      marker
    @map.fit genMarkerBounds @markers

  init: (element, lat, lng) ->
    @map = new Map element,
      zoom: 5
      center: @genLatLng lat, lng

  locationSearch: (address, callback) ->
    geocoder.geocode 'address': address, (results, status) =>
      if results.length
        result = results[0]
        if result.geometry.bounds
          @map.fit result.geometry.bounds
        else
          @map.setCenter result.geometry.location
        callback result
        $rootScope.$apply()

]
