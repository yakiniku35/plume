/* Minimal ambient typings for the parts of MapKit JS that Plume uses. */
declare namespace mapkit {
  function init(options: { authorizationCallback: (done: (token: string) => void) => void; language?: string }): void
  class Coordinate {
    constructor(latitude: number, longitude: number)
    latitude: number
    longitude: number
  }
  class CoordinateSpan {
    constructor(latitudeDelta: number, longitudeDelta: number)
  }
  class CoordinateRegion {
    constructor(center: Coordinate, span: CoordinateSpan)
  }
  class Padding {
    constructor(top: number, right: number, bottom: number, left: number)
  }
  class MarkerAnnotation {
    constructor(coordinate: Coordinate, options?: { color?: string; glyphText?: string; title?: string; subtitle?: string; displayPriority?: number })
    coordinate: Coordinate
  }
  class Map {
    constructor(element: HTMLElement, options?: Record<string, unknown>)
    static ColorSchemes: { Light: string; Dark: string }
    colorScheme: string
    region: CoordinateRegion
    center: Coordinate
    mapType: string
    showsCompass: string
    showsZoomControl: boolean
    showsMapTypeControl: boolean
    showsScale: string
    isScrollEnabled: boolean
    isZoomEnabled: boolean
    annotations: MarkerAnnotation[]
    addAnnotation(a: MarkerAnnotation): void
    removeAnnotations(a: MarkerAnnotation[]): void
    showItems(items: MarkerAnnotation[], options?: { animate?: boolean; padding?: Padding; minimumSpan?: CoordinateSpan }): void
    setRegionAnimated(region: CoordinateRegion, animate?: boolean): void
    setCenterAnimated(center: Coordinate, animate?: boolean): void
    convertPointOnPageToCoordinate(point: DOMPoint): Coordinate
    addEventListener(type: string, listener: (event: { pointOnPage: { x: number; y: number } }) => void): void
    destroy(): void
  }
  const FeatureVisibility: { Hidden: string; Visible: string; Adaptive: string }
}
