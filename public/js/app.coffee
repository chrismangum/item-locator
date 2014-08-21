app = angular.module 'app', []
LatLng = google.maps.LatLng

app.controller 'mainCtrl', ['$scope', '$locations', '$sce', '$window'
  ($scope, $locations, $sce, $window) ->
    $scope.locations = $locations

    $scope.data =
      sortField: 'name'
      groupLabel: ''

    $scope.getLabel = (locations, i) ->
      distance = _.find [500, 250, 100, 50, 20, 10, 5, 1], (dist) ->
        locations[i].distance >= dist and
        (not i or locations[i - 1].distance < dist)
      if distance
        $sce.trustAsHtml "<div class='label label-miles'>#{ distance }+ Miles</div>"

    $scope.unGroup = ->
      $scope.data.groupLabel = ''
      $scope.data.sortField = 'name'

    $scope.$watch 'searchValue', (n) ->
      $locations.filterData name: n

    $scope.hideMobileList = ->
      if $window.innerWidth < 800
        $scope.listOpen = false

    $scope.safeApply = (fn) ->
      unless $scope.$$phase
        $scope.$apply fn
]

app.controller 'map', ['$scope', '$compile', '$locations', '$timeout'
  ($scope, $compile, $locations, $timeout) ->
    pinClick = false
    map = new Map $('#map-canvas')[0]
    infoWindow = new InfoWindow map,
      $compile('<info-window></info-window>') $scope

    map.on 'closeclick', infoWindow, ->
      $locations.deactivateItem()

    calcDistances = (point) ->
      for loc in $locations.data
        loc.distance = map.milesBetween point, new LatLng loc.lat, loc.lng
      return

    $scope.locationSearch = ->
      if $scope.searchAddress
        map.locationSearch $scope.searchAddress, (result) ->
          $locations.unfilterData()
          calcDistances result.geometry.location
          $scope.data.sortField = 'distance'
          $scope.data.groupLabel = "Distance from \"#{ result.formatted_address }\""
          $scope.safeApply()
      else
        $scope.data.sortField = 'name'
        $scope.data.groupLabel = ''

    $scope.$watch (-> $locations.activeItem), (item) ->
      if item
        unless pinClick
          map.setCenter item.marker.position
        infoWindow.open item.marker
        $timeout -> infoWindow.update()

    #filter markers
    $scope.$watch (-> $locations.data), (data = []) ->
      if data.length
        markers = _.pluck data, 'marker'
        for marker in map.markers
          marker.setVisible _.contains markers, marker
        return

    $locations.get('clients.json').then (data) ->
      map.genMarkers data, ->
        pinClick = true
        $locations.activateItem @data
        $scope.safeApply()
        pinClick = false
]

app.directive 'infoWindow', ->
  restrict: 'E'
  templateUrl: 'info-window.html'

app.factory '$locations', ['$http', '$filter', ($http, $filter) ->
  $filter = $filter 'filter'

  activateItem: (item) ->
    @deactivateItem()
    @activeItem = item
    @activeItem.isActive = true

  deactivateItem: ->
    @activeItem?.isActive = false
    @activeItem = null

  filterData: (val) ->
    @data = $filter @_pristineData, val

  get: (url) ->
    $http.get(url).then (res) =>
      @_pristineData = res.data
      @unfilterData()

  unfilterData: ->
    @data = @_pristineData
]

class Geocoder extends google.maps.Geocoder
  geocode: (address, callback) ->
    super address: address, (results, status) ->
      callback results[0] if results.length

class InfoWindow extends google.maps.InfoWindow
  constructor: (@_map, @_template) ->

  open: (context) ->
    super @_map, context

  update: ->
    @setContent @_template.html()

class Marker extends google.maps.Marker
  constructor: (map, item) ->
    super
      map: map
      position: new LatLng item.lat, item.lng
      data: item

class Map extends google.maps.Map
  constructor: (element) ->
    super element,
      #required properties:
      center: new LatLng '39.8282', '-98.5795'
      zoom: 5
      panControl: false
    @geocoder = new Geocoder()

  calcDistance: google.maps.geometry.spherical.computeDistanceBetween

  _genMarkerBounds: (markers) ->
    bounds = new google.maps.LatLngBounds()
    for marker in markers
      bounds.extend marker.position
    bounds

  genMarkers: (data, eventHandler) ->
    @markers = for item in data
      marker = new Marker @, item
      @on 'click', marker, eventHandler
      item.marker = marker
      marker
    @fitBounds @_genMarkerBounds @markers

  locationSearch: (address, callback) ->
    @geocoder.geocode address, (result) =>
      if result.geometry.bounds
        @fitBounds result.geometry.bounds
      else
        @setCenter result.geometry.location
      callback? result

  milesBetween: ->
    Math.round @calcDistance.apply(null, arguments) * 0.000621371

  on: (event, context, callback) ->
    google.maps.event.addListener context, event, callback
