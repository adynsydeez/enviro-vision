import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";

function App() {
  const zoomRef = useRef(20);

  const blueMountainsCoords = [];

  const [mapCenter, setMapCentre] = useState();

  useEffect(() => {
    console.log("konnichiwassup");

    const yo = document.getElementById("container");
    console.log(yo);
  }, []);

  const MapLogger = () => {
    const map = useMap();

    useEffect(() => {
      console.log(map.getCenter());
    }, [map]);

    return null;
  };

  return (
    <>
      <h1>wassup</h1>
      <div style={{ height: "100vh", width: "100%" }}>
        <MapContainer
          id="container"
          center={[-27, 153]}
          zoom={zoomRef.current}
          scrollWheelZoom={true}
          style={{ height: "100%", width: "100%" }}
        >
          <MapLogger />
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}.png"
          />

          <Marker position={[-27, 153]}>
            <Popup>
              A pretty CSS3 popup. <br /> Easily customizable.
            </Popup>
          </Marker>
        </MapContainer>
      </div>
    </>
  );
}

export default App;
