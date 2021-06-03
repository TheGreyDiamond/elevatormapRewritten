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

function on() {
    document.getElementById("overlay").style.display = "block";
  }
  
  function off() {
    document.getElementById("overlay").style.display = "none";
  }