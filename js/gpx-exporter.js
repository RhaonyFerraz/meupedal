// Exportador de arquivos GPX (Compatível com Strava, Garmin Connect e Google Earth)
class GPXExporter {
  static generateGPX(activity) {
    const title = activity.title || 'Pedal MeuPedal';
    const startTime = activity.startTime || activity.date || new Date().toISOString();
    const points = activity.points || [];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" 
     creator="MeuPedal - https://meupedal.app" 
     xmlns="http://www.topografix.com/GPX/1/1"
     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
     xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd http://www.garmin.com/xmlschemas/TrackPointExtension/v1 http://www.garmin.com/xmlschemas/TrackPointExtensionv1.xsd"
     xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">
  <metadata>
    <name>${this._escapeXml(title)}</name>
    <time>${new Date(startTime).toISOString()}</time>
  </metadata>
  <trk>
    <name>${this._escapeXml(title)}</name>
    <type>Cycling</type>
    <trkseg>
`;

    for (const pt of points) {
      const timeStr = pt.time ? new Date(pt.time).toISOString() : new Date().toISOString();
      const ele = pt.alt !== undefined ? Number(pt.alt).toFixed(1) : '0.0';
      const speedMs = pt.speed ? (pt.speed / 3.6).toFixed(2) : '0.0';

      xml += `      <trkpt lat="${pt.lat.toFixed(6)}" lon="${pt.lng.toFixed(6)}">
        <ele>${ele}</ele>
        <time>${timeStr}</time>
        <extensions>
          <gpxtpx:TrackPointExtension>
            <gpxtpx:speed>${speedMs}</gpxtpx:speed>
          </gpxtpx:TrackPointExtension>
        </extensions>
      </trkpt>\n`;
    }

    xml += `    </trkseg>
  </trk>
</gpx>`;

    return xml;
  }

  static download(activity) {
    const xml = this.generateGPX(activity);
    const blob = new Blob([xml], { type: 'application/gpx+xml;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const safeTitle = (activity.title || 'Pedal')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_');

    const dateStr = new Date(activity.date || Date.now()).toISOString().slice(0, 10);
    const filename = `MeuPedal_${dateStr}_${safeTitle}.gpx`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  static _escapeXml(unsafe) {
    return (unsafe || '').replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
      }
    });
  }
}

window.gpxExporter = GPXExporter;
