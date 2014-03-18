app = angular.module 'app', []

app.controller 'mainCtrl', ['$scope', '$http', '$sce', '$map'
  ($scope, $http, $sce, $map) ->
    geocoder = new google.maps.Geocoder()

    $scope.sortField = 'name'
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
      distance = _.find [500, 250, 100, 50, 20, 10, 5, 1], (dist) ->
        locations[i].distance >= dist and (i is 0 or locations[i - 1].distance < dist)
      if distance
        string = "<div class='label label-miles'>#{distance}+ Miles</div>"
      $sce.trustAsHtml string

    calcDistances = (searchPoint) ->
      _.each $scope.data, (loc) ->
        dist = $map.calcDistance searchPoint, $map.genLatLng loc.lat, loc.lng
        dist *= 0.000621371; #convert meters to miles
        loc.distance = parseFloat dist.toFixed()

    $scope.locationSearch = ->
      geocoder.geocode 'address': $scope.searchAddress, (results, status) ->
        if results.length
          result = results[0]
          $map.fit result.geometry.bounds
          calcDistances result.geometry.location
          $scope.filteredData = $scope.data
          $scope.sortField = 'distance'
          $scope.groupLabel = "Distance from \"#{result.formatted_address}\""
          $scope.$apply()
          
    $http.get('clients.json').then (response) ->
      data = response.data
      $scope.data = angular.fromJson data
      $scope.filteredData = $scope.data
]

app.directive 'activateItem', ->
  (scope, el, attrs) ->
    el.on 'click', ->
      scope.$emit 'activateItem', attrs.activateItem

app.directive 'infoWindow', ->
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
    scope.$watch (-> scope.activeItem()), (newItem, oldItem) ->
      if oldItem isnt newItem
        if oldItem
          oldItem.name = oldItem.name.replace '*', ''
        if newItem
          newItem.name += '*'

    scope.$watch 'searchValue', (newVal, oldVal) ->
      if newVal isnt oldVal
        if newVal
          scope.filteredData = $filter('filter') scope.data(), name: newVal
        else
          scope.filteredData = scope.data()

    scope.unGroup = ->
      scope.groupLabel = ''
      scope.$emit 'unGroup'
]

app.directive 'map', ['$compile', '$map', ($compile, $map) ->
  restrict: 'E'
  replace: true
  scope:
    data: '&'
    activeItem: '&'
  template: '<div class="map-wrapper">
    <div class="map" id="map-canvas"></div>
  </div>'
  link: (scope, el) ->
    pinClick = false
    markers = []
    infoWindow = new google.maps.InfoWindow()
    infoWindowTemplate = $compile('<info-window></info-window>') scope

    $map.init '#map-canvas'
      
    google.maps.event.addListener infoWindow, 'closeclick', ->
      scope.$emit 'deactivateItem'

    scope.$watch (-> scope.activeItem()), (item) ->
      if item
        unless pinClick
          $map.center $map.markers[item.index].position
        infoWindow.open $map.map, $map.markers[item.index]

    scope.$emit 'activateItemCallback', ->
      infoWindow.setContent infoWindowTemplate[0].innerHTML

    filterMarkers = (data) ->
      indexes = _.indexBy data, 'index'
      _.each $map.markers, (item, i) ->
        item.setVisible i of indexes

    scope.$watch (-> scope.data()), (newData, oldData) ->
      if newData
        if oldData
          filterMarkers newData
        else
          $map.genMarkers newData, ->
            pinClick = true
            scope.$emit 'activateItem', @index
            pinClick = false
]

app.factory '$map', ->

  genMarkerBounds = (markers) ->
    bounds = new google.maps.LatLngBounds()
    _.each markers, (marker) ->
      bounds.extend marker.position
    bounds

  genLatLng = (lat, lng) ->
    new google.maps.LatLng lat, lng

  calcDistance: (start, end) ->
    google.maps.geometry.spherical.computeDistanceBetween start, end
  center: (point) ->
    @map.setCenter point
  fit: (bounds) ->
    @map.fitBounds bounds
  genLatLng: genLatLng
  genMarkers: (data, eventHandler) ->
    map = @map
    @markers = _.map data, (loc, i) ->
      marker = new google.maps.Marker
        map: map
        position: genLatLng loc.lat, loc.lng
        index: i
      google.maps.event.addListener marker, 'click', eventHandler
      marker
    @fit genMarkerBounds @markers
  init: (selector) ->
    @map = new google.maps.Map $(selector)[0],
      zoom: 5
      center: genLatLng 39.8282, -98.5795
