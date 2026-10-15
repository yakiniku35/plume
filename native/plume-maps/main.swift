// plume-maps: a tiny command-line helper that gives Plume real Apple Maps on macOS
// without a MapKit JS token. Commands read one JSON argument and print JSON.
//   plume-maps snapshot '{"lat":25.04,"lng":121.56,"latDelta":0.05,"lngDelta":0.05,"width":800,"height":400,"dark":false,"scale":2,"markers":[{"lat":..,"lng":..}],"fit":true}'
//   plume-maps search   '{"q":"台北車站","lat":25.04,"lng":121.56}'
//   plume-maps reverse  '{"lat":25.04,"lng":121.56}'
import Foundation
import MapKit
import CoreLocation
import AppKit

struct Marker: Codable { let lat: Double; let lng: Double }
struct SnapshotRequest: Codable {
  var lat: Double?; var lng: Double?; var latDelta: Double?; var lngDelta: Double?
  var width: Double; var height: Double; var dark: Bool?; var scale: Double?
  var markers: [Marker]?; var fit: Bool?
}
struct SearchRequest: Codable { let q: String; let lat: Double?; let lng: Double? }
struct ReverseRequest: Codable { let lat: Double; let lng: Double }

func fail(_ message: String) -> Never {
  let out = ["error": message]
  let data = try! JSONSerialization.data(withJSONObject: out)
  FileHandle.standardOutput.write(data)
  exit(1)
}
func emit(_ obj: Any) -> Never {
  let data = try! JSONSerialization.data(withJSONObject: obj)
  FileHandle.standardOutput.write(data)
  exit(0)
}

DispatchQueue.global().asyncAfter(deadline: .now() + 20) { fail("timeout") }
let args = CommandLine.arguments
guard args.count >= 3, let payload = args[2].data(using: .utf8) else { fail("usage: plume-maps <snapshot|search|reverse> <json>") }
let decoder = JSONDecoder()

switch args[1] {
case "snapshot":
  guard let req = try? decoder.decode(SnapshotRequest.self, from: payload) else { fail("bad snapshot request") }
  let options = MKMapSnapshotter.Options()
  options.size = CGSize(width: req.width, height: req.height)
  options.mapType = .mutedStandard
  options.pointOfInterestFilter = .excludingAll
  options.appearance = NSAppearance(named: (req.dark ?? false) ? .darkAqua : .aqua)
  let markers = req.markers ?? []
  if (req.fit ?? false) && !markers.isEmpty {
    var minLat = 90.0, maxLat = -90.0, minLng = 180.0, maxLng = -180.0
    for m in markers { minLat = min(minLat, m.lat); maxLat = max(maxLat, m.lat); minLng = min(minLng, m.lng); maxLng = max(maxLng, m.lng) }
    let center = CLLocationCoordinate2D(latitude: (minLat + maxLat) / 2, longitude: (minLng + maxLng) / 2)
    let span = MKCoordinateSpan(latitudeDelta: max(0.02, (maxLat - minLat) * 1.6), longitudeDelta: max(0.02, (maxLng - minLng) * 1.6))
    options.region = MKCoordinateRegion(center: center, span: span)
  } else {
    let center = CLLocationCoordinate2D(latitude: req.lat ?? 25.04, longitude: req.lng ?? 121.56)
    let span = MKCoordinateSpan(latitudeDelta: req.latDelta ?? 0.05, longitudeDelta: req.lngDelta ?? 0.05)
    options.region = MKCoordinateRegion(center: center, span: span)
  }
  let snapshotter = MKMapSnapshotter(options: options)
  snapshotter.start(with: .main) { snapshot, error in
    guard let snapshot = snapshot else { fail(error?.localizedDescription ?? "snapshot failed") }
    let scale = req.scale ?? 2
    let image = snapshot.image
    let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: Int(req.width * scale), pixelsHigh: Int(req.height * scale), bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
    image.draw(in: NSRect(x: 0, y: 0, width: req.width * scale, height: req.height * scale))
    NSGraphicsContext.restoreGraphicsState()
    let png = rep.representation(using: .png, properties: [:]) ?? Data()
    let points: [[Double]] = markers.map { m in
      let p = snapshot.point(for: CLLocationCoordinate2D(latitude: m.lat, longitude: m.lng))
      return [Double(p.x), Double(p.y)]
    }
    let r = options.region
    emit([
      "png": png.base64EncodedString(),
      "points": points,
      "region": ["lat": r.center.latitude, "lng": r.center.longitude, "latDelta": r.span.latitudeDelta, "lngDelta": r.span.longitudeDelta]
    ])
  }
  RunLoop.main.run()

case "search":
  guard let req = try? decoder.decode(SearchRequest.self, from: payload) else { fail("bad search request") }
  let request = MKLocalSearch.Request()
  request.naturalLanguageQuery = req.q
  if let lat = req.lat, let lng = req.lng {
    request.region = MKCoordinateRegion(center: CLLocationCoordinate2D(latitude: lat, longitude: lng), span: MKCoordinateSpan(latitudeDelta: 0.5, longitudeDelta: 0.5))
  }
  MKLocalSearch(request: request).start { response, error in
    guard let response = response else { fail(error?.localizedDescription ?? "search failed") }
    var items: [[String: Any]] = []
    for item in response.mapItems.prefix(8) {
      let c = item.placemark.coordinate
      let addr = [item.placemark.locality, item.placemark.subLocality, item.placemark.thoroughfare].compactMap { $0 }.joined(separator: " ")
      items.append(["name": item.name ?? addr, "address": addr, "lat": c.latitude, "lng": c.longitude])
    }
    emit(["results": items])
  }
  RunLoop.main.run()

case "reverse":
  guard let req = try? decoder.decode(ReverseRequest.self, from: payload) else { fail("bad reverse request") }
  CLGeocoder().reverseGeocodeLocation(CLLocation(latitude: req.lat, longitude: req.lng)) { placemarks, _ in
    guard let p = placemarks?.first else { emit(["name": NSNull()]) }
    let parts = [p.subLocality ?? p.thoroughfare, p.locality ?? p.subAdministrativeArea ?? p.administrativeArea].compactMap { $0 }
    let name = parts.isEmpty ? (p.name ?? p.country) : parts.joined(separator: ", ")
    emit(["name": name as Any])
  }
  RunLoop.main.run()

default:
  fail("unknown command")
}
