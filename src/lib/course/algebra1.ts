// Updated to match the current OrlandoMath Algebra 1 section structure

export type Chapter = {
  id: string;            // e.g. "ch1"
  number: number;        // 1..12
  title: string;         // human title for cards/pages
  points: number;        // Regents points
  percent: number;       // % of exam (out of 88)
  dashboardBlurb: string;
  chapterBlurb: string;
};

export type Section = {
  id: string;            // e.g. "ch1_s1"
  chapterId: string;     // e.g. "ch1"
  chapterNumber: number; // 1..12
  sectionNumber: number; // 1..N within chapter
  title: string;
  standardCode?: string; // e.g. "A.SSE.A.1"
};

export const TOTAL_REGENTS_POINTS = 88;

export const CHAPTERS: Chapter[] = [
  {
    id: "ch1",
    number: 1,
    title: "Expressions & Equations",
    points: 10,
    percent: 11.4,
    dashboardBlurb: "Build the algebraic foundation by modeling, rewriting, and interpreting expressions and equations.",
    chapterBlurb:
      "This chapter builds the algebraic foundation of the course. Students model expressions, identify properties, solve linear equations, write equations from context, and transform formulas. These skills appear frequently on the Regents and support nearly every later topic."
  },
  {
    id: "ch2",
    number: 2,
    title: "Quantities & Units",
    points: 2,
    percent: 2.3,
    dashboardBlurb: "Use units and quantities correctly to avoid simple but costly mistakes on word problems.",
    chapterBlurb:
      "This chapter focuses on using units and quantities correctly when interpreting mathematical relationships. While it accounts for a small number of Regents points, errors in unit reasoning can cost students easy credit. Mastery here helps prevent avoidable mistakes across word problems throughout the exam."
  },
  {
    id: "ch3",
    number: 3,
    title: "Linear Functions & Equations",
    points: 8,
    percent: 9.1,
    dashboardBlurb: "Interpret linear relationships, graph lines, and write equations from given information.",
    chapterBlurb:
      "This chapter develops student understanding of linear relationships through modeling, graphing, and writing equations. Students connect slope, intercepts, and context to equations and graphs. These ideas are heavily used throughout Algebra 1 and appear often on the Regents."
  },
  {
    id: "ch4",
    number: 4,
    title: "Inequalities",
    points: 6,
    percent: 6.8,
    dashboardBlurb: "Solve and model inequalities and interpret their solutions in context.",
    chapterBlurb:
      "This chapter focuses on solving linear inequalities and modeling real-world situations with inequality statements. Students learn how inequality solutions differ from equation solutions and how to interpret phrases such as at least, no more than, and greater than."
  },
  {
    id: "ch5",
    number: 5,
    title: "Quadratics",
    points: 16,
    percent: 18.2,
    dashboardBlurb: "Solve, graph, and compare quadratic functions and equations.",
    chapterBlurb:
      "Quadratics are one of the most important Regents topics. In this chapter, students solve quadratic equations, interpret quadratic graphs, analyze intervals of increase and decrease, and compare multiple quadratic representations. This chapter is a major source of Regents points."
  },
  {
    id: "ch6",
    number: 6,
    title: "Powers",
    points: 2,
    percent: 2.3,
    dashboardBlurb: "Apply exponent rules to simplify powers and expressions involving exponents.",
    chapterBlurb:
      "This chapter focuses on exponent rules such as multiplication of powers and powers of powers. These skills support later work with polynomials, scientific notation, and function rules, and they appear as short but important Regents questions."
  },
  {
    id: "ch7",
    number: 7,
    title: "Polynomials & Factoring",
    points: 6,
    percent: 6.8,
    dashboardBlurb: "Perform polynomial operations, factor expressions, and identify zeros.",
    chapterBlurb:
      "This chapter develops student fluency with polynomial operations and factoring. Students simplify expressions, factor trinomials and differences of squares, and identify zeros of polynomials. These ideas are essential for quadratic work and higher-level algebra."
  },
  {
    id: "ch8",
    number: 8,
    title: "Radicals",
    points: 4,
    percent: 4.5,
    dashboardBlurb: "Simplify and operate with radicals and recognize equivalent radical expressions.",
    chapterBlurb:
      "Students learn to add, subtract, multiply, and simplify radical expressions. These questions are usually short and procedural, which makes this chapter an efficient place to build confidence and earn Regents points."
  },
  {
    id: "ch9",
    number: 9,
    title: "Systems",
    points: 17,
    percent: 19.3,
    dashboardBlurb: "Model and solve systems of equations, inequalities, and quadratic-linear relationships.",
    chapterBlurb:
      "Systems are one of the highest-value Algebra 1 topics. In this chapter, students model real-world situations with systems, graph and interpret solutions, analyze systems of inequalities, and solve quadratic-linear systems. This chapter often appears in extended-response Regents work."
  },
  {
    id: "ch10",
    number: 10,
    title: "Functions",
    points: 8,
    percent: 9.1,
    dashboardBlurb: "Understand functions, notation, domain and range, and transformations.",
    chapterBlurb:
      "This chapter formalizes the study of functions. Students define functions, evaluate them using notation, analyze domain and range, identify families of functions, study transformations, and compare function representations. These ideas support nearly every later math course."
  },
  {
    id: "ch11",
    number: 11,
    title: "Sequences",
    points: 2,
    percent: 2.3,
    dashboardBlurb: "Work with arithmetic and geometric sequences using pattern structure.",
    chapterBlurb:
      "This chapter introduces sequences with an emphasis on recognizing and extending patterns. While it contributes a small number of Regents points, the questions are often accessible for students who understand sequence structure."
  },
  {
    id: "ch12",
    number: 12,
    title: "Statistics",
    points: 6,
    percent: 6.8,
    dashboardBlurb: "Analyze data using distributions, displays, and regression.",
    chapterBlurb:
      "Students analyze data using graphs, plots, regression, and correlation. Statistics questions on the Regents are often visual and procedural, making this chapter an important opportunity to earn points efficiently."
  }
];

export const SECTIONS: Section[] = [
  {
    id: "ch1_s1",
    chapterId: "ch1",
    chapterNumber: 1,
    sectionNumber: 1,
    title: "Modeling Expressions",
    standardCode: "A.SSE.A.1"
  },
  {
    id: "ch1_s2",
    chapterId: "ch1",
    chapterNumber: 1,
    sectionNumber: 2,
    title: "Identifying Properties",
    standardCode: "A.REI.A.1"
  },
  {
    id: "ch1_s3",
    chapterId: "ch1",
    chapterNumber: 1,
    sectionNumber: 3,
    title: "Solving Linear Equations",
    standardCode: "A.REI.B.3"
  },
  {
    id: "ch1_s4",
    chapterId: "ch1",
    chapterNumber: 1,
    sectionNumber: 4,
    title: "Modeling Linear Equations",
    standardCode: "A.CED.A.1"
  },
  {
    id: "ch1_s5",
    chapterId: "ch1",
    chapterNumber: 1,
    sectionNumber: 5,
    title: "Transforming Formulas",
    standardCode: "A.CED.A.4"
  },

  {
    id: "ch2_s1",
    chapterId: "ch2",
    chapterNumber: 2,
    sectionNumber: 1,
    title: "Conversions",
    standardCode: "N.Q.A.1"
  },
  {
    id: "ch2_s2",
    chapterId: "ch2",
    chapterNumber: 2,
    sectionNumber: 2,
    title: "Rate of Change",
    standardCode: "F.IF.B.6"
  },

  {
    id: "ch3_s1",
    chapterId: "ch3",
    chapterNumber: 3,
    sectionNumber: 1,
    title: "Modeling Linear Functions",
    standardCode: "F.LE.B.5"
  },
  {
    id: "ch3_s2",
    chapterId: "ch3",
    chapterNumber: 3,
    sectionNumber: 2,
    title: "Graphing Linear Functions",
    standardCode: "F.IF.B.4"
  },
  {
    id: "ch3_s3",
    chapterId: "ch3",
    chapterNumber: 3,
    sectionNumber: 3,
    title: "Writing Linear Equations",
    standardCode: "A.REI.D.10"
  },

  {
    id: "ch4_s1",
    chapterId: "ch4",
    chapterNumber: 4,
    sectionNumber: 1,
    title: "Solving Linear Inequalities",
    standardCode: "A.REI.B.3"
  },
  {
    id: "ch4_s2",
    chapterId: "ch4",
    chapterNumber: 4,
    sectionNumber: 2,
    title: "Modeling Linear Inequalities",
    standardCode: "A.CED.A.1"
  },

  {
    id: "ch5_s1",
    chapterId: "ch5",
    chapterNumber: 5,
    sectionNumber: 1,
    title: "Solving Quadratics",
    standardCode: "A.REI.B.4"
  },
  {
    id: "ch5_s2",
    chapterId: "ch5",
    chapterNumber: 5,
    sectionNumber: 2,
    title: "Graphing Quadratic Functions",
    standardCode: "F.IF.B.4"
  },
  {
    id: "ch5_s3",
    chapterId: "ch5",
    chapterNumber: 5,
    sectionNumber: 3,
    title: "Quadratic Graph Features",
    standardCode: "F.IF.C.7"
  },
  {
    id: "ch5_s4",
    chapterId: "ch5",
    chapterNumber: 5,
    sectionNumber: 4,
    title: "Comparing Quadratic Functions",
    standardCode: "F.IF.C.9"
  },

  {
    id: "ch6_s1",
    chapterId: "ch6",
    chapterNumber: 6,
    sectionNumber: 1,
    title: "Multiplication of Powers",
    standardCode: "A.APR.A.1"
  },
  {
    id: "ch6_s2",
    chapterId: "ch6",
    chapterNumber: 6,
    sectionNumber: 2,
    title: "Powers of Powers",
    standardCode: "A.APR.A.1"
  },

  {
    id: "ch7_s1",
    chapterId: "ch7",
    chapterNumber: 7,
    sectionNumber: 1,
    title: "Identifying Solutions",
    standardCode: "A.REI.D.10"
  },
  {
    id: "ch7_s2",
    chapterId: "ch7",
    chapterNumber: 7,
    sectionNumber: 2,
    title: "Operations with Polynomials",
    standardCode: "A.APR.A.1"
  },
  {
    id: "ch7_s3",
    chapterId: "ch7",
    chapterNumber: 7,
    sectionNumber: 3,
    title: "Factoring Polynomials",
    standardCode: "A.SSE.A.2"
  },
  {
    id: "ch7_s4",
    chapterId: "ch7",
    chapterNumber: 7,
    sectionNumber: 4,
    title: "Factoring the Difference of Perfect Squares",
    standardCode: "A.SSE.A.2"
  },
  {
    id: "ch7_s5",
    chapterId: "ch7",
    chapterNumber: 7,
    sectionNumber: 5,
    title: "Zeros of Polynomials",
    standardCode: "A.APR.B.3"
  },

  {
    id: "ch8_s1",
    chapterId: "ch8",
    chapterNumber: 8,
    sectionNumber: 1,
    title: "Operations with Radicals",
    standardCode: "N.RN.B.3"
  },

  {
    id: "ch9_s1",
    chapterId: "ch9",
    chapterNumber: 9,
    sectionNumber: 1,
    title: "Modeling Linear Systems",
    standardCode: "A.CED.A.3"
  },
  {
    id: "ch9_s2",
    chapterId: "ch9",
    chapterNumber: 9,
    sectionNumber: 2,
    title: "Graphing Linear Systems",
    standardCode: "A.REI.C.6"
  },
  {
    id: "ch9_s3",
    chapterId: "ch9",
    chapterNumber: 9,
    sectionNumber: 3,
    title: "Graphing Systems of Linear Inequalities",
    standardCode: "A.CED.A.3"
  },
  {
    id: "ch9_s4",
    chapterId: "ch9",
    chapterNumber: 9,
    sectionNumber: 4,
    title: "Quadratic–Linear Systems",
    standardCode: "A.REI.C.7"
  },

  {
    id: "ch10_s1",
    chapterId: "ch10",
    chapterNumber: 10,
    sectionNumber: 1,
    title: "Defining Functions",
    standardCode: "F.IF.A.1"
  },
  {
    id: "ch10_s2",
    chapterId: "ch10",
    chapterNumber: 10,
    sectionNumber: 2,
    title: "Function Notation",
    standardCode: "F.IF.A.2"
  },
  {
    id: "ch10_s3",
    chapterId: "ch10",
    chapterNumber: 10,
    sectionNumber: 3,
    title: "Domain and Range",
    standardCode: "F.IF.A.2 / F.IF.B.5"
  },
  {
    id: "ch10_s4",
    chapterId: "ch10",
    chapterNumber: 10,
    sectionNumber: 4,
    title: "Families of Functions",
    standardCode: "F.LE.A.1 / F.LE.A.3"
  },
  {
    id: "ch10_s5",
    chapterId: "ch10",
    chapterNumber: 10,
    sectionNumber: 5,
    title: "Transformations with Functions",
    standardCode: "F.BF.B.3"
  },
  {
    id: "ch10_s6",
    chapterId: "ch10",
    chapterNumber: 10,
    sectionNumber: 6,
    title: "Comparing Functions",
    standardCode: "F.IF.C.7 / F.IF.C.9"
  },

  {
    id: "ch11_s1",
    chapterId: "ch11",
    chapterNumber: 11,
    sectionNumber: 1,
    title: "Sequences – Part 1",
    standardCode: "F.IF.A.3"
  },
  {
    id: "ch11_s2",
    chapterId: "ch11",
    chapterNumber: 11,
    sectionNumber: 2,
    title: "Sequences – Part 2",
    standardCode: "F.BF.A.1"
  },

  {
    id: "ch12_s1",
    chapterId: "ch12",
    chapterNumber: 12,
    sectionNumber: 1,
    title: "Central Tendency and Dispersion",
    standardCode: "S.ID.A.2"
  },
  {
    id: "ch12_s2",
    chapterId: "ch12",
    chapterNumber: 12,
    sectionNumber: 2,
    title: "Frequency Tables",
    standardCode: "S.ID.B.5"
  },
  {
    id: "ch12_s3",
    chapterId: "ch12",
    chapterNumber: 12,
    sectionNumber: 3,
    title: "Box Plots",
    standardCode: "S.ID.A.1"
  },
  {
    id: "ch12_s4",
    chapterId: "ch12",
    chapterNumber: 12,
    sectionNumber: 4,
    title: "Dot Plots",
    standardCode: "S.ID.A.1"
  },
  {
    id: "ch12_s5",
    chapterId: "ch12",
    chapterNumber: 12,
    sectionNumber: 5,
    title: "Regression",
    standardCode: "S.ID.B.6"
  }
];

// Helpers
export function getChapters() {
  return CHAPTERS.slice().sort((a, b) => a.number - b.number);
}

export function getChapter(chapterId: string) {
  return CHAPTERS.find((c) => c.id === chapterId);
}

export function getSectionsForChapter(chapterId: string) {
  return SECTIONS
    .filter((s) => s.chapterId === chapterId)
    .slice()
    .sort((a, b) => a.sectionNumber - b.sectionNumber);
}