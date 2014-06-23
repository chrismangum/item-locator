app = angular.module 'app', []
LatLng = google.maps.LatLng

app.controller 'mainCtrl', ['$scope', '$locations'
  ($scope, $locations) ->
    $scope.locations = $locations
    $scope.data =
      sortField: 'name'
      groupLabel: ''

    $scope.safeApply = (fn) ->
      unless $scope.$$phase
        $scope.$apply fn

    $locations.get 'clients.json'
]

app.directive 'activateItem', ['$locations', ($locations) ->
  ($scope, el, attrs) ->
    el.on 'click', ->
      $locations.activateItem $scope.$eval attrs.activateItem
]

app.directive 'infoWindow', ->
  restrict: 'E'
  templateUrl: 'info-window.html'

app.directive 'list', ['$locations', '$sce', ($locations, $sce) ->
  restrict: 'E'
  transclude: true
  scope: true
  templateUrl: 'list.html'
  replace: true
  link: ($scope) ->
    $scope.getLabel = (locations, i) ->
      distance = _.find [500, 250, 100, 50, 20, 10, 5, 1], (dist) ->
        locations[i].distance >= dist and (not i or locations[i - 1].distance < dist)
      if distance
        string = "<div class='label label-miles'>#{ distance }+ Miles</div>"
      $sce.trustAsHtml string

    $scope.unGroup = ->
      $scope.data.groupLabel = ''
      $scope.data.sortField = 'name'

    $scope.$watch 'searchValue', (n, o) ->
      if n isnt o
        $locations.filterData name: n
]

app.controller 'map', ['$scope', '$compile', '$locations'
  ($scope, $compile, $locations) ->
    pinClick = false
    map = new Map $('#map-canvas')[0]
    infoWindow = new InfoWindow $compile('<info-window></info-window>')($scope)[0], map

    map.on 'closeclick', infoWindow, ->
      $locations.deactivateItem true

    filterMarkers = (data) ->
      markers = _.pluck data, 'marker'
      for marker in map.markers
        marker.setVisible _.contains markers, marker

    $locations.activateItemCallback = ->
      infoWindow.update()

    calcDistances = (searchPoint) ->
      for loc in $locations.data
        loc.distance = map.calcDistance searchPoint, new LatLng loc.lat, loc.lng

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

    $scope.$watch (->
      $locations.activeItem
    ), (item) ->
      if item
        unless pinClick
          map.setCenter item.marker.position
        infoWindow.open item.marker

    $scope.$watch (->
      $locations.data
    ), (n, o) ->
      if n
        if o
          filterMarkers n
        else
          map.genMarkers n, ->
            pinClick = true
            $locations.activateItem @data
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
    if _.isArray bounds
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
