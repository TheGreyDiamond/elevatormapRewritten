
    var lockMap = false;

    function noRestore() {
      off();
      Cookies.remove("tempStore")
    }

    function restoreFunc() {
      try {
        dataBlock = JSON.parse(dataBlock)
        document.getElementById("lat").value = dataBlock["lat"]
        document.getElementById("lng").value = dataBlock["lng"]
        document.getElementById("type").value = dataBlock["type"]
        document.getElementById("visit").value = dataBlock["visit"]
        document.getElementById("pepl").value = dataBlock["pepl"]
        document.getElementById("weig").value = dataBlock["weig"]
        document.getElementById("manuf").value = dataBlock["manuf"]
        document.getElementById("model").value = dataBlock["model"]
        document.getElementById("flor").value = dataBlock["flor"]
        document.getElementById("description").value = dataBlock["description"]
      } catch (ex) {
        dataBlock = {}
      }
      off()
    }

    dataBlock = Cookies.get("tempStore");
    if (dataBlock == undefined) {
      dataBlock = {};
    } else {
      on()
    }

    var currentPage = 0;
    function saveValues() {
      dataBlock["lat"] = document.getElementById("lat").value
      dataBlock["lng"] = document.getElementById("lng").value
      dataBlock["type"] = document.getElementById("type").value
      dataBlock["visit"] = document.getElementById("visit").value
      dataBlock["pepl"] = document.getElementById("pepl").value
      dataBlock["weig"] = document.getElementById("weig").value
      dataBlock["manuf"] = document.getElementById("manuf").value
      dataBlock["model"] = document.getElementById("model").value
      dataBlock["flor"] = document.getElementById("flor").value
      dataBlock["description"] = document.getElementById("description").value
      Cookies.set('tempStore', JSON.stringify(dataBlock))
    }

    function submit() {
      currentPage = 6;
      updateDialog()
      saveValues()
      const options = {
        method: 'POST',
        body: JSON.stringify({})
      };

      fetch('/api/saveNewElevatorMeta', options)
        .then(response => response.json())
        .then(response => {
          console.warn("!!!!!!!!!!!!", response)
          document.getElementById("imageUploadInfo").style.display = 'block';
          var filesToSend = $('#myFile').prop('files').length;
          var i = 0;
          while (i < filesToSend) {
            document.getElementById("imageUploadInfo").innerHTML = "Uploading image " + String(i) + "/" + String(filesToSend)
            console.log("Files left to send: ", filesToSend - i)
            var file_data = $('#myFile').prop('files')[i];
            var form_data = new FormData();
            form_data.append('file', file_data);

            console.log(file_data)
            if (String(file_data.type).includes("image/")) {
              $.ajax({
                url: '/api/uploadImage?id=' + response.id,
                dataType: 'json',
                cache: false,
                contentType: false,
                processData: false,
                data: form_data,
                type: 'post',
                success: function (data) {
                  alert(data);
                }
              });
            } else {
              console.log("Skipping nonimage file")
            }
            i++;
          }
          console.log("DONE!")
        });








    }
    function updateDialog() {
      if (currentPage == 0) {
        document.getElementById("step1").style.display = 'block';
        document.getElementById("step2").style.display = 'none';
        document.getElementById("step3").style.display = 'none';
        document.getElementById("step4").style.display = 'none';
      }
      if (currentPage == 1) {
        document.getElementById("step1").style.display = 'none';
        document.getElementById("step2").style.display = 'block';
        document.getElementById("step3").style.display = 'none';
        document.getElementById("step4").style.display = 'none';
      }
      if (currentPage == 2) {
        document.getElementById("step1").style.display = 'none';
        document.getElementById("step2").style.display = 'none';
        document.getElementById("step3").style.display = 'block';
        document.getElementById("step4").style.display = 'none';
        lockMap = false;
      }
      if (currentPage == 3) {
        document.getElementById("step1").style.display = 'none';
        document.getElementById("step2").style.display = 'none';
        document.getElementById("step3").style.display = 'none';
        document.getElementById("step4").style.display = 'block';
        document.getElementById("step5").style.display = 'none';
        document.getElementById("missingAlert").style.display = 'none';
        lockMap = true;
      }
      if (currentPage == 4) {
        document.getElementById("step1").style.display = 'none';
        document.getElementById("step2").style.display = 'none';
        document.getElementById("step3").style.display = 'none';
        document.getElementById("step4").style.display = 'none';

        containsEmpt = false;
        for (const [key, value] of Object.entries(dataBlock)) {
          if (value == "" || value == undefined) {
            console.log("hi")
            console.log(key, value)
            containsEmpt = true;
            document.getElementById("missingAlert").style.display = 'block';
          }
        }
        if (containsEmpt == false) {
          document.getElementById("missingAlert").style.display = 'none';
          currentPage = 5;
        }
        console.log(containsEmpt);
      }
      if (currentPage == 5) {
        document.getElementById("step1").style.display = 'none';
        document.getElementById("step2").style.display = 'none';
        document.getElementById("step3").style.display = 'none';
        document.getElementById("step4").style.display = 'none';
        document.getElementById("step5").style.display = 'block';
        document.getElementById("missingAlert").style.display = 'none';
      }
      if (currentPage == 6) {
        document.getElementById("step1").style.display = 'none';
        document.getElementById("step2").style.display = 'none';
        document.getElementById("step3").style.display = 'none';
        document.getElementById("step4").style.display = 'none';
        document.getElementById("step5").style.display = 'none';
        document.getElementById("step6").style.display = 'block';
        document.getElementById("missingAlert").style.display = 'none';
      }
      saveValues();
      console.log(dataBlock)

    }
    function nextDialogePage() {
      currentPage++;
      updateDialog();
    }
    function prevPage() {
      currentPage--;
      updateDialog();
    }


    var latElm = document.getElementById("lat");
    var lngElm = document.getElementById("lng");

    latElm.addEventListener('input', function (evt) {
      if(!lockMap){
        markers.clearLayers();
        console.log(evt.target.value)
        const lat = evt.target.value;
        const lng = lngElm.value;
        var marker = new theMarker([lat, lng])
        //marker.addTo(mymap)
        markers.addLayer(marker);
        markers.addTo(mymap);
      }

    });

    lngElm.addEventListener('input', function (evt) {
      if(!lockMap){
      markers.clearLayers();
      console.log(evt.target.value)
      const lat = latElm.value;
      const lng = evt.target.value;
      var marker = new theMarker([lat, lng])
      //marker.addTo(mymap)
      markers.addLayer(marker);
      markers.addTo(mymap);
      }
    });

    var amountOfImages = 0;
    var markers = L.markerClusterGroup();
    slideIndex = 1;

    var mymap = L.map("map").setView([51.505, -0.09], 50);

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
  
      home()
  
      mymap.on('click', function (e) {
        if(!lockMap){
        markers.clearLayers();
        var coord = e.latlng;
        var lat = coord.lat;
        var lng = coord.lng;
        var marker = new theMarker([lat, lng])
        //marker.addTo(mymap)
        markers.addLayer(marker);
        markers.addTo(mymap);
        document.getElementById("lat").value = lat
        document.getElementById("lng").value = lng
        console.log("You clicked the map at latitude: " + lat + " and longitude: " + lng);
        }else{
          console.log("The map is locked.")
        }
      });
  
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
  