import { category } from "./types";
const col_table = {
  "astro": "blue",
  "gr" : "blue",
  "cs" : "dodgerblue",
  "math" : "crimson",
  "physics" : "purple",
  "hep" : "purple",
  "nucl" : "purple",
  "quant" : "maroon"
}
export const is_ams = (cat : category) => cat.search(/,/) === -1;
export const cat_col = (cat : category) => col_table[cat.split(".")[0].split("-")[0]] || "grey";
export const all_categories : {c : category, d : string}[] = [
  {
    "c": "astro-ph",
    "d": "Astrophysics"
  },
  {
    "c": "astro-ph.CO",
    "d": "Cosmology and Nongalactic Astrophysics"
  },
  {
    "c": "astro-ph.EP",
    "d": "Earth and Planetary Astrophysics"
  },
  {
    "c": "astro-ph.GA",
    "d": "Astrophysics of Galaxies"
  },
  {
    "c": "astro-ph.HE",
    "d": "High Energy Astrophysical Phenomena"
  },
  {
    "c": "astro-ph.IM",
    "d": "Instrumentation and Methods for Astrophysics"
  },
  {
    "c": "astro-ph.SR",
    "d": "Solar and Stellar Astrophysics"
  },
  {
    "c": "cond-mat.dis-nn",
    "d": "Disordered Systems and Neural Networks"
  },
  {
    "c": "cond-mat.mes-hall",
    "d": "Mesoscale and Nanoscale Physics"
  },
  {
    "c": "cond-mat.mtrl-sci",
    "d": "Materials Science"
  },
  {
    "c": "cond-mat.other",
    "d": "Other Condensed Matter"
  },
  {
    "c": "cond-mat.quant-gas",
    "d": "Quantum Gases"
  },
  {
    "c": "cond-mat.soft",
    "d": "Soft Condensed Matter"
  },
  {
    "c": "cond-mat.stat-mech",
    "d": "Statistical Mechanics"
  },
  {
    "c": "cond-mat.str-el",
    "d": "Strongly Correlated Electrons"
  },
  {
    "c": "cond-mat.supr-con",
    "d": "Superconductivity"
  },
  {
    "c": "cs.AI",
    "d": "Artificial Intelligence"
  },
  {
    "c": "cs.AR",
    "d": "Hardware Architecture"
  },
  {
    "c": "cs.CC",
    "d": "Computational Complexity"
  },
  {
    "c": "cs.CE",
    "d": "Computational Engineering, Finance, and Science"
  },
  {
    "c": "cs.CG",
    "d": "Computational Geometry"
  },
  {
    "c": "cs.CL",
    "d": "Computation and Language"
  },
  {
    "c": "cs.CR",
    "d": "Cryptography and Security"
  },
  {
    "c": "cs.CV",
    "d": "Computer Vision and Pattern Recognition"
  },
  {
    "c": "cs.CY",
    "d": "Computers and Society"
  },
  {
    "c": "cs.DB",
    "d": "Databases"
  },
  {
    "c": "cs.DC",
    "d": "Distributed, Parallel, and Cluster Computing"
  },
  {
    "c": "cs.DL",
    "d": "Digital Libraries"
  },
  {
    "c": "cs.DM",
    "d": "Discrete Mathematics"
  },
  {
    "c": "cs.DS",
    "d": "Data Structures and Algorithms"
  },
  {
    "c": "cs.ET",
    "d": "Emerging Technologies"
  },
  {
    "c": "cs.FL",
    "d": "Formal Languages and Automata Theory"
  },
  {
    "c": "cs.GL",
    "d": "General Literature"
  },
  {
    "c": "cs.GR",
    "d": "Graphics"
  },
  {
    "c": "cs.GT",
    "d": "Computer Science and Game Theory"
  },
  {
    "c": "cs.HC",
    "d": "Human-Computer Interaction"
  },
  {
    "c": "cs.IR",
    "d": "Information Retrieval"
  },
  {
    "c": "cs.IT",
    "d": "Information Theory"
  },
  {
    "c": "cs.LG",
    "d": "Learning"
  },
  {
    "c": "cs.LO",
    "d": "Logic in Computer Science"
  },
  {
    "c": "cs.MA",
    "d": "Multiagent Systems"
  },
  {
    "c": "cs.MM",
    "d": "Multimedia"
  },
  {
    "c": "cs.MS",
    "d": "Mathematical Software"
  },
  {
    "c": "cs.NA",
    "d": "Numerical Analysis"
  },
  {
    "c": "cs.NE",
    "d": "Neural and Evolutionary Computing"
  },
  {
    "c": "cs.NI",
    "d": "Networking and Internet Architecture"
  },
  {
    "c": "cs.OH",
    "d": "Other Computer Science"
  },
  {
    "c": "cs.OS",
    "d": "Operating Systems"
  },
  {
    "c": "cs.PF",
    "d": "Performance"
  },
  {
    "c": "cs.PL",
    "d": "Programming Languages"
  },
  {
    "c": "cs.RO",
    "d": "Robotics"
  },
  {
    "c": "cs.SC",
    "d": "Symbolic Computation"
  },
  {
    "c": "cs.SD",
    "d": "Sound"
  },
  {
    "c": "cs.SE",
    "d": "Software Engineering"
  },
  {
    "c": "cs.SI",
    "d": "Social and Information Networks"
  },
  {
    "c": "cs.SY",
    "d": "Systems and Control"
  },
  {
    "c": "econ.EM",
    "d": "Econometrics"
  },
  {
    "c": "eess.AS",
    "d": "Audio and Speech Processing"
  },
  {
    "c": "eess.IV",
    "d": "Image and Video Processing"
  },
  {
    "c": "eess.SP",
    "d": "Signal Processing"
  },
  {
    "c": "gr-qc",
    "d": "General Relativity and Quantum Cosmology"
  },
  {
    "c": "hep-ex",
    "d": "High Energy Physics - Experiment"
  },
  {
    "c": "hep-lat",
    "d": "High Energy Physics - Lattice"
  },
  {
    "c": "hep-ph",
    "d": "High Energy Physics - Phenomenology"
  },
  {
    "c": "hep-th",
    "d": "High Energy Physics - Theory"
  },
  {
    "c": "math.AC",
    "d": "Commutative Algebra"
  },
  {
    "c": "math.AG",
    "d": "Algebraic Geometry"
  },
  {
    "c": "math.AP",
    "d": "Analysis of PDEs"
  },
  {
    "c": "math.AT",
    "d": "Algebraic Topology"
  },
  {
    "c": "math.CA",
    "d": "Classical Analysis and ODEs"
  },
  {
    "c": "math.CO",
    "d": "Combinatorics"
  },
  {
    "c": "math.CT",
    "d": "Category Theory"
  },
  {
    "c": "math.CV",
    "d": "Complex Variables"
  },
  {
    "c": "math.DG",
    "d": "Differential Geometry"
  },
  {
    "c": "math.DS",
    "d": "Dynamical Systems"
  },
  {
    "c": "math.FA",
    "d": "Functional Analysis"
  },
  {
    "c": "math.GM",
    "d": "General Mathematics"
  },
  {
    "c": "math.GN",
    "d": "General Topology"
  },
  {
    "c": "math.GR",
    "d": "Group Theory"
  },
  {
    "c": "math.GT",
    "d": "Geometric Topology"
  },
  {
    "c": "math.HO",
    "d": "History and Overview"
  },
  {
    "c": "math.IT",
    "d": "Information Theory"
  },
  {
    "c": "math.KT",
    "d": "K-Theory and Homology"
  },
  {
    "c": "math.LO",
    "d": "Logic"
  },
  {
    "c": "math.MG",
    "d": "Metric Geometry"
  },
  {
    "c": "math.MP",
    "d": "Mathematical Physics"
  },
  {
    "c": "math.NA",
    "d": "Numerical Analysis"
  },
  {
    "c": "math.NT",
    "d": "Number Theory"
  },
  {
    "c": "math.OA",
    "d": "Operator Algebras"
  },
  {
    "c": "math.OC",
    "d": "Optimization and Control"
  },
  {
    "c": "math.PR",
    "d": "Probability"
  },
  {
    "c": "math.QA",
    "d": "Quantum Algebra"
  },
  {
    "c": "math.RA",
    "d": "Rings and Algebras"
  },
  {
    "c": "math.RT",
    "d": "Representation Theory"
  },
  {
    "c": "math.SG",
    "d": "Symplectic Geometry"
  },
  {
    "c": "math.SP",
    "d": "Spectral Theory"
  },
  {
    "c": "math.ST",
    "d": "Statistics Theory"
  },
  {
    "c": "math-ph",
    "d": "Mathematical Physics"
  },
  {
    "c": "nlin.AO",
    "d": "Adaptation and Self-Organizing Systems"
  },
  {
    "c": "nlin.CD",
    "d": "Chaotic Dynamics"
  },
  {
    "c": "nlin.CG",
    "d": "Cellular Automata and Lattice Gases"
  },
  {
    "c": "nlin.PS",
    "d": "Pattern Formation and Solitons"
  },
  {
    "c": "nlin.SI",
    "d": "Exactly Solvable and Integrable Systems"
  },
  {
    "c": "nucl-ex",
    "d": "Nuclear Experiment"
  },
  {
    "c": "nucl-th",
    "d": "Nuclear Theory"
  },
  {
    "c": "physics.acc-ph",
    "d": "Accelerator Physics"
  },
  {
    "c": "physics.ao-ph",
    "d": "Atmospheric and Oceanic Physics"
  },
  {
    "c": "physics.app-ph",
    "d": "Applied Physics"
  },
  {
    "c": "physics.atm-clus",
    "d": "Atomic and Molecular Clusters"
  },
  {
    "c": "physics.atom-ph",
    "d": "Atomic Physics"
  },
  {
    "c": "physics.bio-ph",
    "d": "Biological Physics"
  },
  {
    "c": "physics.chem-ph",
    "d": "Chemical Physics"
  },
  {
    "c": "physics.class-ph",
    "d": "Classical Physics"
  },
  {
    "c": "physics.comp-ph",
    "d": "Computational Physics"
  },
  {
    "c": "physics.data-an",
    "d": "Data Analysis, Statistics and Probability"
  },
  {
    "c": "physics.ed-ph",
    "d": "Physics Education"
  },
  {
    "c": "physics.flu-dyn",
    "d": "Fluid Dynamics"
  },
  {
    "c": "physics.gen-ph",
    "d": "General Physics"
  },
  {
    "c": "physics.geo-ph",
    "d": "Geophysics"
  },
  {
    "c": "physics.hist-ph",
    "d": "History and Philosophy of Physics"
  },
  {
    "c": "physics.ins-det",
    "d": "Instrumentation and Detectors"
  },
  {
    "c": "physics.med-ph",
    "d": "Medical Physics"
  },
  {
    "c": "physics.optics",
    "d": "Optics"
  },
  {
    "c": "physics.plasm-ph",
    "d": "Plasma Physics"
  },
  {
    "c": "physics.pop-ph",
    "d": "Popular Physics"
  },
  {
    "c": "physics.soc-ph",
    "d": "Physics and Society"
  },
  {
    "c": "physics.space-ph",
    "d": "Space Physics"
  },
  {
    "c": "q-bio.BM",
    "d": "Biomolecules"
  },
  {
    "c": "q-bio.CB",
    "d": "Cell Behavior"
  },
  {
    "c": "q-bio.GN",
    "d": "Genomics"
  },
  {
    "c": "q-bio.MN",
    "d": "Molecular Networks"
  },
  {
    "c": "q-bio.NC",
    "d": "Neurons and Cognition"
  },
  {
    "c": "q-bio.OT",
    "d": "Other Quantitative Biology"
  },
  {
    "c": "q-bio.PE",
    "d": "Populations and Evolution"
  },
  {
    "c": "q-bio.QM",
    "d": "Quantitative Methods"
  },
  {
    "c": "q-bio.SC",
    "d": "Subcellular Processes"
  },
  {
    "c": "q-bio.TO",
    "d": "Tissues and Organs"
  },
  {
    "c": "q-fin.CP",
    "d": "Computational Finance"
  },
  {
    "c": "q-fin.EC",
    "d": "Economics"
  },
  {
    "c": "q-fin.GN",
    "d": "General Finance"
  },
  {
    "c": "q-fin.MF",
    "d": "Mathematical Finance"
  },
  {
    "c": "q-fin.PM",
    "d": "Portfolio Management"
  },
  {
    "c": "q-fin.PR",
    "d": "Pricing of Securities"
  },
  {
    "c": "q-fin.RM",
    "d": "Risk Management"
  },
  {
    "c": "q-fin.ST",
    "d": "Statistical Finance"
  },
  {
    "c": "q-fin.TR",
    "d": "Trading and Market Microstructure"
  },
  {
    "c": "quant-ph",
    "d": "Quantum Physics"
  },
  {
    "c": "stat.AP",
    "d": "Applications"
  },
  {
    "c": "stat.CO",
    "d": "Computation"
  },
  {
    "c": "stat.ME",
    "d": "Methodology"
  },
  {
    "c": "stat.ML",
    "d": "Machine Learning"
  },
  {
    "c": "stat.OT",
    "d": "Other Statistics"
  },
  {
    "c": "stat.TH",
    "d": "Statistics Theory"
  }
]
let desc_table = {};
for (let {c,d} of all_categories) {
  desc_table[c] = d;
}
/**Look up the description of a given category. */
export const cat_desc = (cat : category) : string | undefined => desc_table[cat]
