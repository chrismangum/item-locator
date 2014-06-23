app = angular.module 'app', []
LatLng = google.maps.LatLng

class Geocoder extends google.maps.Geocoder
  geocode: (address, map, callback) ->
    super 'address': address, (results, status) ->
      if results.length
        result = results[0]
        if result.geometry.bounds
          map.fitBounds result.geometry.bounds
        else
          map.setCenter result.geometry.location
        callback? result

class InfoWindow extends google.maps.InfoWindow
  constructor: (@_template, @_map) ->

  open: (context) ->
    super @_map, context

  update: ->
    @setContent @_template.innerHTML

class Map extends google.maps.Map
  constructor: (element) ->
    super element,
      #required properties:
      center: new LatLng '39.8282', '-98.5795'
      zoom: 5
      panControl: false
    @geocoder = new Geocoder()

  calcDistance: (start, end) ->
    dist = google.maps.geometry.spherical.computeDistanceBetween start, end
    Math.round dist * 0.000621371 #convert meters to miles and round

  fitBounds: (bounds) ->
    if bounds.length
      super @_genMarkerBounds bounds
    else
      super bounds

  _genMarkerBounds: (markers) ->
    bounds = new google.maps.LatLngBounds()
    for marker in markers
      bounds.extend marker.position
    bounds

  genMarkers: (data, eventHandler) ->
    @markers = _.map data, (loc, i) =>
      marker = new google.maps.Marker
        map: @
        position: new LatLng loc.lat, loc.lng
        data: loc
      @on 'click', marker, eventHandler
      loc.marker = marker
      marker
    @fitBounds @markers

  locationSearch: (address, callback) ->
    @geocoder.geocode address, @, (result) ->
      callback result

  on: (event, context, callback) ->
    google.maps.event.addListener context, event, callback



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
        loc.distance = $map.map.calcDistance searchPoint, new LatLng loc.lat, loc.lng

    $scope.locationSearch = ->
      if $scope.searchAddress
        $map.map.locationSearch $scope.searchAddress, (result) ->
          $locations.unfilterData()
          calcDistances result.geometry.location
          $scope.sortField = 'distance'
          $scope.groupLabel = "Distance from \"#{result.formatted_address}\""
          $scope.$apply()
      else
        $scope.sortField = 'name'
        $scope.groupLabel = ''

    $locations.get 'clients.json'
]

app.directive 'activateItem', ->
  (scope, el, attrs) ->
    el.on 'click', ->
      scope.locations.activateItem scope.$apply attrs.activateItem

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
  template: '<div class="map"><div class="map-canvas" id="map-canvas"></div></div>'
  link: (scope, element, attrs) ->
    pinClick = false

    $map.init element.children()[0]
    infoWindow = new InfoWindow $compile('<info-window></info-window>')(scope)[0], $map.map

    $map.map.on 'closeclick', infoWindow, ->
      scope.locations.deactivateItem true

    scope.$watch 'locations.activeItem', (item) ->
      if item
        unless pinClick
          $map.map.setCenter item.marker.position
        infoWindow.open item.marker

    filterMarkers = (data) ->
      markers = _.pluck data, 'marker'
      for marker in $map.map.markers
        marker.setVisible markers.indexOf(marker) isnt -1

    scope.locations.activateItemCallback = ->
      infoWindow.update()

    scope.$watch 'locations.data', (newData, oldData) ->
      if newData
        if oldData
          filterMarkers newData
        else
          $map.map.genMarkers newData, ->
            pinClick = true
            scope.locations.activateItem @data
            pinClick = false
]

app.factory '$locations', ['$rootScope', '$http', '$filter'
  ($rootScope, $http, $filter) ->

    activateItem: (item) ->
      @deactivateItem()
      @activeItem = item
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

app.factory '$map', ->
  init: (element) ->
    @map = new Map element
