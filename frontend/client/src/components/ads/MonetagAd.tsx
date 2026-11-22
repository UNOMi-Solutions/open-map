import { useEffect } from 'react';

const MonetagAd = ({ zoneId, scriptSrc } : { zoneId: string; scriptSrc: string }) => {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = scriptSrc;
    script.setAttribute('data-zone', zoneId);
    script.async = true;
    script.setAttribute('data-cfasync', 'false');

    document.body.appendChild(script);

    // Clean up the script when the component unmounts
    return () => {
      document.body.removeChild(script);
    };
  }, [zoneId, scriptSrc]);

  return null;
};

export default MonetagAd;
