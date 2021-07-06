function createNewElev() {
  window.location.href = "/createElevator";
}

var amountOfImages = 0;
var markers = L.markerClusterGroup();
slideIndex = 1;



theMarker = L.Marker.extend({
  options: {
    id: "-1",
  },
});

function showPosition(position) {
  console.log(position.coords);

  mymap.setView(
    new L.LatLng(position.coords.latitude, position.coords.longitude),
    10
  );
  // mymap.setView(new L.LatLng(10.737, -73.923), 8);
}

function onClick(e) {
  slideIndex = 1;
  document.getElementById("inspector").innerHTML =
    '<br><br><center><div class="lds-ripple"><div></div><div></div></div></center>';
  res = JSON.parse(httpGet("/api/getElevatorById?id=" + this.options.id));
  if (res.state == "Ok") {
    visitStates = [
      "Test elevator",
      "Public",
      "On private property",
      "Public but locked",
    ];
    typeStates = [
      "Hydraulic",
      "Wiredriven, motor in shaft",
      "Wiredriven, motor in motorroom",
    ];

    // Prepare the template
    inspector = httpGet("/templates/inspectorContent.html");
    inspector = inspector.replace("#MODELL", res.results[0].modell);
    inspector = inspector.replace("#MANUF", res.results[0].manufacturer);
    inspector = inspector.replace("#DESC", res.results[0].info);
    inspector = inspector.replace(
      "#TYPE",
      typeStates[res.results[0].technology]
    );
    inspector = inspector.replace("#MAXPASS", res.results[0].maxPassangers);
    inspector = inspector.replace("#MASSWEIGH", res.results[0].maxWeight);
    inspector = inspector.replace(
      "#VISIT",
      visitStates[res.results[0].visitabilty]
    );
    try {
      var username = JSON.parse(
        httpGet("/api/resolveNameById?id=" + res.results[0].creator)
      ).results[0].username;
    } catch {
      username = "Unknown";
    }

    inspector = inspector.replace("#CREATOR", username);
    document.getElementById("inspector").innerHTML = inspector;

    // Make gallery
    document.getElementById("imageGallery").innerHTML =
      "<div class='slideshow-container'>";
    imgs = JSON.parse(res.results[0].images);
    amountOfImages = imgs.images.length;
    console.log(imgs);
    var iH = 0;

    while (amountOfImages > iH) {
      newBox = "<center><div class='mySlides fade'><div class='numbertext'>";
      newBox += iH + 1;
      newBox += "/";
      newBox += amountOfImages;
      newBox += "</div><img src='";
      newBox += imgs.images[iH].path;
      newBox +=
        "' alt='" +
        imgs.images[iH].alt +
        "' class=\"elevatorPhoto\"><div class='text'> </div></div></center>";
      document.getElementById("imageGallery").innerHTML += newBox;
      iH++;
    }
    document.getElementById("imageGallery").innerHTML +=
      "<br><a class='prev' onclick='plusSlides(-1)''>&#10094;</a><a class='next' onclick='plusSlides(1)'>&#10095;</a></div><br><div style='text-align:center'></div><br><br><br>";
    showSlides(1);
  } else {
    document.getElementById("inspector").innerHTML =
      '                                                  \
          <center>                                                                                            \
          <h1><i style="color: red;" class="fas fa-exclamation-triangle"></i></h1>                            \
          <h1>Oh no!</h1>                                                                                     \
          The website failed to fetch the information about this elevator. It responded with the error code:  \
          <br><code>                                                                                          \
          ' +
      res.message +
      "</code><center>";
  }

  console.log(res);
}

function httpGet(theUrl) {
  var xmlHttp = new XMLHttpRequest();
  xmlHttp.open("GET", theUrl, false); // false for synchronous request
  xmlHttp.send(null);
  return xmlHttp.responseText;
}

function home() {
  if (navigator.geolocation) {
    setTimeout(function () {
      navigator.geolocation.getCurrentPosition(showPosition);
    }, 200);
  } else {
    console.warn("Geolocation of user could not be fetched");
  }
}

home();

function addPin(item, index) {
  var marker = new theMarker([item.lat, item.lng], {
    id: item.id,
  }).on("click", onClick);
  // var marker = new L.Marker()
  //marker.addTo(mymap).on('click', onClick);
  markers.on("clusterclick", function (a) {
    //alert('cluster ' + a.layer.getAllChildMarkers().length);
  });
  markers.addLayer(marker);
}

// Start getting the elevators
response = httpGet(
  "/api/getElevatorLocation?lan=" +
    mymap.getCenter.lng +
    "&lat=" +
    mymap.getCenter.lat +
    "&radius=" +
    mymap.getZoom()
);
response = JSON.parse(response);

if (response.state == "Ok") {
  response.results.forEach(addPin);
  mymap.addLayer(markers);
} else {
  // DONT FORGET TO SHOW POPUP OR SOMETHING
  console.log("Request failed with " + response.message);
  console.log(response);
  alert("Loading of the map pins failed");
}

// Next/previous controls
function plusSlides(n) {
  showSlides((slideIndex += n));
}

// Thumbnail image controls
function currentSlide(n) {
  showSlides((slideIndex = n));
}

function showSlides(n) {
  var i;
  var slides = document.getElementsByClassName("mySlides");
  var dots = document.getElementsByClassName("dot");
  if (n > slides.length) {
    slideIndex = 1;
  }
  if (n < 1) {
    slideIndex = slides.length;
  }
  for (i = 0; i < slides.length; i++) {
    slides[i].style.display = "none";
  }
  for (i = 0; i < dots.length; i++) {
    dots[i].className = dots[i].className.replace(" active", "");
  }
  slides[slideIndex - 1].style.display = "block";
  dots[slideIndex - 1].className += " active";
}
