import React, { createContext, useContext, useEffect, useState } from 'react';

const LocationContext = createContext(null);

export const LocationProvider = ({ children }) => {
  // Default to Patiala City center coordinates (~30.339, 76.385)
  const [coords, setCoords] = useState({
    latitude: 30.3398,
    longitude: 76.3850
  });
  const [hasGps, setHasGps] = useState(false);
  const [error, setError] = useState(null);
  const [radiusMeters, setRadiusMeters] = useState(1500);

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude
        });
        setHasGps(true);
        setError(null);
      },
      (err) => {
        console.log('[Geolocation] GPS access denied or unavailable, using Patiala default center.');
        setError(err.message);
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  useEffect(() => {
    requestLocation();
  }, []);

  return (
    <LocationContext.Provider
      value={{
        coords,
        hasGps,
        error,
        radiusMeters,
        setRadiusMeters,
        requestLocation
      }}
    >
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
};
