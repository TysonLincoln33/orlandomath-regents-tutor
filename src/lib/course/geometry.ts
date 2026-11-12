import type { Chapter, Section } from "./algebra1";

export const GEOMETRY_CHAPTERS: Chapter[] = [
  {
    "id": "geo-ch1",
    "number": 1,
    "title": "Tools of Geometry",
    "courseId": "geometry",
    "questionCount": 3,
    "points": 0,
    "percent": 0,
    "dashboardBlurb": "Explore solids, rotations, and cross-sections.",
    "chapterBlurb": "Explore solids, rotations, and cross-sections."
  },
  {
    "id": "geo-ch2",
    "number": 2,
    "title": "Lines and Angles",
    "courseId": "geometry",
    "questionCount": 7,
    "points": 0,
    "percent": 0,
    "dashboardBlurb": "Use coordinates, slopes, and angle relationships.",
    "chapterBlurb": "Use coordinates, slopes, and angle relationships."
  },
  {
    "id": "geo-ch3",
    "number": 3,
    "title": "Triangles",
    "courseId": "geometry",
    "questionCount": 13,
    "points": 0,
    "percent": 0,
    "dashboardBlurb": "Apply triangle properties, special triangles, and proportional segments.",
    "chapterBlurb": "Apply triangle properties, special triangles, and proportional segments."
  },
  {
    "id": "geo-ch4",
    "number": 4,
    "title": "Polygons",
    "courseId": "geometry",
    "questionCount": 8,
    "points": 0,
    "percent": 0,
    "dashboardBlurb": "Reason about quadrilaterals using properties and coordinate proofs.",
    "chapterBlurb": "Reason about quadrilaterals using properties and coordinate proofs."
  },
  {
    "id": "geo-ch5",
    "number": 5,
    "title": "Conics",
    "courseId": "geometry",
    "questionCount": 7,
    "points": 0,
    "percent": 0,
    "dashboardBlurb": "Work with circle equations, chords, secants, and tangents.",
    "chapterBlurb": "Work with circle equations, chords, secants, and tangents."
  },
  {
    "id": "geo-ch6",
    "number": 6,
    "title": "Measuring in the Plane and Space",
    "courseId": "geometry",
    "questionCount": 22,
    "points": 0,
    "percent": 0,
    "dashboardBlurb": "Calculate perimeter, area, volume, and density.",
    "chapterBlurb": "Calculate perimeter, area, volume, and density."
  },
  {
    "id": "geo-ch7",
    "number": 7,
    "title": "Transformations",
    "courseId": "geometry",
    "questionCount": 30,
    "points": 0,
    "percent": 0,
    "dashboardBlurb": "Explore rigid motions, dilations, and similarity.",
    "chapterBlurb": "Explore rigid motions, dilations, and similarity."
  },
  {
    "id": "geo-ch8",
    "number": 8,
    "title": "Trigonometry",
    "courseId": "geometry",
    "questionCount": 15,
    "points": 0,
    "percent": 0,
    "dashboardBlurb": "Use trigonometric ratios to find lengths, angles, and areas.",
    "chapterBlurb": "Use trigonometric ratios to find lengths, angles, and areas."
  },
  {
    "id": "geo-ch9",
    "number": 9,
    "title": "Logic and Proofs",
    "courseId": "geometry",
    "questionCount": 4,
    "points": 0,
    "percent": 0,
    "dashboardBlurb": "Build complete geometric arguments with guided proof tables.",
    "chapterBlurb": "Build complete geometric arguments with guided proof tables."
  }
];

export const GEOMETRY_SECTIONS: Section[] = [
  {
    "id": "geo-ch1_s1",
    "chapterId": "geo-ch1",
    "courseId": "geometry",
    "chapterNumber": 1,
    "sectionNumber": 1,
    "title": "Rotations of Two-Dimensional Objects",
    "standardCode": "G.GMD.B.4",
    "questionIds": [
      "geo-q001",
      "geo-q002"
    ],
    "questionCount": 2
  },
  {
    "id": "geo-ch1_s2",
    "chapterId": "geo-ch1",
    "courseId": "geometry",
    "chapterNumber": 1,
    "sectionNumber": 2,
    "title": "Cross-Sections of Three-Dimensional Objects",
    "standardCode": "G.GMD.B.4",
    "questionIds": [
      "geo-q003"
    ],
    "questionCount": 1
  },
  {
    "id": "geo-ch2_s1",
    "chapterId": "geo-ch2",
    "courseId": "geometry",
    "chapterNumber": 2,
    "sectionNumber": 1,
    "title": "Directed Line Segments",
    "standardCode": "G.GPE.B.6",
    "questionIds": [
      "geo-q008",
      "geo-q009",
      "geo-q010"
    ],
    "questionCount": 3
  },
  {
    "id": "geo-ch2_s2",
    "chapterId": "geo-ch2",
    "courseId": "geometry",
    "chapterNumber": 2,
    "sectionNumber": 2,
    "title": "Lines and Angles",
    "standardCode": "G.CO.C.9",
    "questionIds": [
      "geo-q011"
    ],
    "questionCount": 1
  },
  {
    "id": "geo-ch2_s3",
    "chapterId": "geo-ch2",
    "courseId": "geometry",
    "chapterNumber": 2,
    "sectionNumber": 3,
    "title": "Parallel and Perpendicular Lines",
    "standardCode": "G.GPE.B.5",
    "questionIds": [
      "geo-q012",
      "geo-q013",
      "geo-q014"
    ],
    "questionCount": 3
  },
  {
    "id": "geo-ch3_s1",
    "chapterId": "geo-ch3",
    "courseId": "geometry",
    "chapterNumber": 3,
    "sectionNumber": 1,
    "title": "Special Right Triangles",
    "standardCode": "G.SRT.C.8",
    "questionIds": [
      "geo-q015",
      "geo-q016"
    ],
    "questionCount": 2
  },
  {
    "id": "geo-ch3_s2",
    "chapterId": "geo-ch3",
    "courseId": "geometry",
    "chapterNumber": 3,
    "sectionNumber": 2,
    "title": "Side Splitter Theorem",
    "standardCode": "G.SRT.B.4",
    "questionIds": [
      "geo-q017",
      "geo-q018",
      "geo-q019"
    ],
    "questionCount": 3
  },
  {
    "id": "geo-ch3_s3",
    "chapterId": "geo-ch3",
    "courseId": "geometry",
    "chapterNumber": 3,
    "sectionNumber": 3,
    "title": "Interior and Exterior Angles of Triangles",
    "standardCode": "G.CO.C.10",
    "questionIds": [
      "geo-q020",
      "geo-q021",
      "geo-q022",
      "geo-q023"
    ],
    "questionCount": 4
  },
  {
    "id": "geo-ch3_s4",
    "chapterId": "geo-ch3",
    "courseId": "geometry",
    "chapterNumber": 3,
    "sectionNumber": 4,
    "title": "Triangle Inequality Theorem",
    "standardCode": "G.CO.C.10",
    "questionIds": [
      "geo-q024"
    ],
    "questionCount": 1
  },
  {
    "id": "geo-ch3_s5",
    "chapterId": "geo-ch3",
    "courseId": "geometry",
    "chapterNumber": 3,
    "sectionNumber": 5,
    "title": "Midsegments",
    "standardCode": "G.CO.C.10",
    "questionIds": [
      "geo-q025",
      "geo-q026"
    ],
    "questionCount": 2
  },
  {
    "id": "geo-ch3_s6",
    "chapterId": "geo-ch3",
    "courseId": "geometry",
    "chapterNumber": 3,
    "sectionNumber": 6,
    "title": "Centroid, Orthocenter, Incenter and Circumcenter",
    "standardCode": "G.SRT.B.4",
    "questionIds": [
      "geo-q027"
    ],
    "questionCount": 1
  },
  {
    "id": "geo-ch4_s1",
    "chapterId": "geo-ch4",
    "courseId": "geometry",
    "chapterNumber": 4,
    "sectionNumber": 1,
    "title": "Interior and Exterior Angles of Polygons",
    "standardCode": "G.CO.C.11",
    "questionIds": [
      "geo-q028"
    ],
    "questionCount": 1
  },
  {
    "id": "geo-ch4_s2",
    "chapterId": "geo-ch4",
    "courseId": "geometry",
    "chapterNumber": 4,
    "sectionNumber": 2,
    "title": "Trapezoids",
    "standardCode": "G.CO.C.11",
    "questionIds": [
      "geo-q029"
    ],
    "questionCount": 1
  },
  {
    "id": "geo-ch4_s3",
    "chapterId": "geo-ch4",
    "courseId": "geometry",
    "chapterNumber": 4,
    "sectionNumber": 3,
    "title": "Special Quadrilaterals",
    "standardCode": "G.CO.C.11",
    "questionIds": [
      "geo-q030",
      "geo-q031",
      "geo-q032"
    ],
    "questionCount": 3
  },
  {
    "id": "geo-ch4_s4",
    "chapterId": "geo-ch4",
    "courseId": "geometry",
    "chapterNumber": 4,
    "sectionNumber": 4,
    "title": "Quadrilaterals in the Coordinate Plane",
    "standardCode": "G.GPE.B.4",
    "questionIds": [
      "geo-q033",
      "geo-q034",
      "geo-q035"
    ],
    "questionCount": 3
  },
  {
    "id": "geo-ch5_s1",
    "chapterId": "geo-ch5",
    "courseId": "geometry",
    "chapterNumber": 5,
    "sectionNumber": 1,
    "title": "Chords, Secants and Tangents",
    "standardCode": "G.C.A.2",
    "questionIds": [
      "geo-q036",
      "geo-q037",
      "geo-q038"
    ],
    "questionCount": 3
  },
  {
    "id": "geo-ch5_s2",
    "chapterId": "geo-ch5",
    "courseId": "geometry",
    "chapterNumber": 5,
    "sectionNumber": 2,
    "title": "Equations of Circles",
    "standardCode": "G.GPE.A.1",
    "questionIds": [
      "geo-q039",
      "geo-q040",
      "geo-q041",
      "geo-q042"
    ],
    "questionCount": 4
  },
  {
    "id": "geo-ch6_s1",
    "chapterId": "geo-ch6",
    "courseId": "geometry",
    "chapterNumber": 6,
    "sectionNumber": 1,
    "title": "Polygons in the Coordinate Plane",
    "standardCode": "G.GPE.B.7",
    "questionIds": [
      "geo-q043",
      "geo-q044",
      "geo-q045"
    ],
    "questionCount": 3
  },
  {
    "id": "geo-ch6_s2",
    "chapterId": "geo-ch6",
    "courseId": "geometry",
    "chapterNumber": 6,
    "sectionNumber": 2,
    "title": "Compositions of Polygons and Circles",
    "standardCode": "G.MG.A.3",
    "questionIds": [
      "geo-q046"
    ],
    "questionCount": 1
  },
  {
    "id": "geo-ch6_s3",
    "chapterId": "geo-ch6",
    "courseId": "geometry",
    "chapterNumber": 6,
    "sectionNumber": 3,
    "title": "Arc Length",
    "standardCode": "G.C.B.5",
    "questionIds": [
      "geo-q047",
      "geo-q048"
    ],
    "questionCount": 2
  },
  {
    "id": "geo-ch6_s4",
    "chapterId": "geo-ch6",
    "courseId": "geometry",
    "chapterNumber": 6,
    "sectionNumber": 4,
    "title": "Sectors",
    "standardCode": "G.C.B.5",
    "questionIds": [
      "geo-q049"
    ],
    "questionCount": 1
  },
  {
    "id": "geo-ch6_s5",
    "chapterId": "geo-ch6",
    "courseId": "geometry",
    "chapterNumber": 6,
    "sectionNumber": 5,
    "title": "Volume",
    "standardCode": "G.GMD.A.3",
    "questionIds": [
      "geo-q050",
      "geo-q051",
      "geo-q052",
      "geo-q053",
      "geo-q054",
      "geo-q055",
      "geo-q056",
      "geo-q057",
      "geo-q058"
    ],
    "questionCount": 9
  },
  {
    "id": "geo-ch6_s6",
    "chapterId": "geo-ch6",
    "courseId": "geometry",
    "chapterNumber": 6,
    "sectionNumber": 6,
    "title": "Density",
    "standardCode": "G.MG.A.2",
    "questionIds": [
      "geo-q059",
      "geo-q060",
      "geo-q061",
      "geo-q062",
      "geo-q063",
      "geo-q064"
    ],
    "questionCount": 6
  },
  {
    "id": "geo-ch7_s1",
    "chapterId": "geo-ch7",
    "courseId": "geometry",
    "chapterNumber": 7,
    "sectionNumber": 1,
    "title": "Line Dilations",
    "standardCode": "G.SRT.A.1",
    "questionIds": [
      "geo-q065",
      "geo-q066",
      "geo-q067"
    ],
    "questionCount": 3
  },
  {
    "id": "geo-ch7_s2",
    "chapterId": "geo-ch7",
    "courseId": "geometry",
    "chapterNumber": 7,
    "sectionNumber": 2,
    "title": "Dilations",
    "standardCode": "G.SRT.A.2",
    "questionIds": [
      "geo-q068",
      "geo-q069",
      "geo-q070"
    ],
    "questionCount": 3
  },
  {
    "id": "geo-ch7_s3",
    "chapterId": "geo-ch7",
    "courseId": "geometry",
    "chapterNumber": 7,
    "sectionNumber": 3,
    "title": "Mapping a Polygon onto Itself",
    "standardCode": "G.CO.A.3",
    "questionIds": [
      "geo-q071",
      "geo-q072",
      "geo-q073"
    ],
    "questionCount": 3
  },
  {
    "id": "geo-ch7_s4",
    "chapterId": "geo-ch7",
    "courseId": "geometry",
    "chapterNumber": 7,
    "sectionNumber": 4,
    "title": "Compositions of Transformations",
    "standardCode": "G.CO.A.5",
    "questionIds": [
      "geo-q074",
      "geo-q075",
      "geo-q076"
    ],
    "questionCount": 3
  },
  {
    "id": "geo-ch7_s5",
    "chapterId": "geo-ch7",
    "courseId": "geometry",
    "chapterNumber": 7,
    "sectionNumber": 5,
    "title": "Properties of Transformations",
    "standardCode": "G.CO.B.6",
    "questionIds": [
      "geo-q077",
      "geo-q078",
      "geo-q079",
      "geo-q080"
    ],
    "questionCount": 4
  },
  {
    "id": "geo-ch7_s6",
    "chapterId": "geo-ch7",
    "courseId": "geometry",
    "chapterNumber": 7,
    "sectionNumber": 6,
    "title": "Identifying Transformations",
    "standardCode": "G.CO.A.2",
    "questionIds": [
      "geo-q081",
      "geo-q082",
      "geo-q083",
      "geo-q084",
      "geo-q085"
    ],
    "questionCount": 5
  },
  {
    "id": "geo-ch7_s7",
    "chapterId": "geo-ch7",
    "courseId": "geometry",
    "chapterNumber": 7,
    "sectionNumber": 7,
    "title": "Analytical Representations of Transformations",
    "standardCode": "G.CO.A.2",
    "questionIds": [
      "geo-q086"
    ],
    "questionCount": 1
  },
  {
    "id": "geo-ch7_s8",
    "chapterId": "geo-ch7",
    "courseId": "geometry",
    "chapterNumber": 7,
    "sectionNumber": 8,
    "title": "Similarity",
    "standardCode": "G.SRT.B.4",
    "questionIds": [
      "geo-q087",
      "geo-q088",
      "geo-q089"
    ],
    "questionCount": 3
  },
  {
    "id": "geo-ch7_s9",
    "chapterId": "geo-ch7",
    "courseId": "geometry",
    "chapterNumber": 7,
    "sectionNumber": 9,
    "title": "Similarity",
    "standardCode": "G.SRT.B.5",
    "questionIds": [
      "geo-q090",
      "geo-q091",
      "geo-q092",
      "geo-q093",
      "geo-q094"
    ],
    "questionCount": 5
  },
  {
    "id": "geo-ch8_s1",
    "chapterId": "geo-ch8",
    "courseId": "geometry",
    "chapterNumber": 8,
    "sectionNumber": 1,
    "title": "Cofunctions",
    "standardCode": "G.SRT.C.7",
    "questionIds": [
      "geo-q095",
      "geo-q096"
    ],
    "questionCount": 2
  },
  {
    "id": "geo-ch8_s2",
    "chapterId": "geo-ch8",
    "courseId": "geometry",
    "chapterNumber": 8,
    "sectionNumber": 2,
    "title": "Using Trigonometry to Find a Side",
    "standardCode": "G.SRT.C.8",
    "questionIds": [
      "geo-q097",
      "geo-q098",
      "geo-q099",
      "geo-q100",
      "geo-q101",
      "geo-q102"
    ],
    "questionCount": 6
  },
  {
    "id": "geo-ch8_s3",
    "chapterId": "geo-ch8",
    "courseId": "geometry",
    "chapterNumber": 8,
    "sectionNumber": 3,
    "title": "Using Trigonometry to Find an Angle",
    "standardCode": "G.SRT.C.8",
    "questionIds": [
      "geo-q103",
      "geo-q104",
      "geo-q105"
    ],
    "questionCount": 3
  },
  {
    "id": "geo-ch8_s4",
    "chapterId": "geo-ch8",
    "courseId": "geometry",
    "chapterNumber": 8,
    "sectionNumber": 4,
    "title": "Using Trigonometry to Find Area",
    "standardCode": "G.SRT.D.9",
    "questionIds": [
      "geo-q106",
      "geo-q107",
      "geo-q108",
      "geo-q109"
    ],
    "questionCount": 4
  },
  {
    "id": "geo-ch9_s1",
    "chapterId": "geo-ch9",
    "courseId": "geometry",
    "chapterNumber": 9,
    "sectionNumber": 1,
    "title": "Triangle Proofs",
    "standardCode": "G.SRT.B.5",
    "questionIds": [
      "geo-q110"
    ],
    "questionCount": 1
  },
  {
    "id": "geo-ch9_s2",
    "chapterId": "geo-ch9",
    "courseId": "geometry",
    "chapterNumber": 9,
    "sectionNumber": 2,
    "title": "Quadrilateral Proofs",
    "standardCode": "G.SRT.B.5",
    "questionIds": [
      "geo-q111",
      "geo-q112",
      "geo-q113"
    ],
    "questionCount": 3
  }
];
