export const platforms = {
	illumina: {
		name: "Illumina",
		instruments: {
			"MiSeq": {
				flowcells: {
					"Nano Kit v2": {reads_millions: 1.0,  cycles: [300, 500]},
					"Micro Kit v2": {reads_millions: 4.0,  cycles: [300]},
					"Kit v2": {reads_millions: 15.0, cycles: [50, 300, 500]},
					"Kit v3": {reads_millions: 25.0,  cycles: [150, 600]}
				}
			},
			"NextSeq 500/550": {
				flowcells: {
					"Mid Output Kit": {reads_millions: 130.0, cycles: [75, 150, 300]},
					"High Output Kit": {reads_millions: 400.0, cycles: [150, 300]}
				}
			},
			"NextSeq 2000": {
				flowcells: {
					"P1": {reads_millions: 100.0, cycles: [100, 300, 600]},
					"P2": {reads_millions: 400.0, cycles: [100, 200, 300, 600]},
					"P3": {reads_millions: 1200.0, cycles: [100, 200, 300]},
					"P4": {reads_millions: 1800.0, cycles: [50, 100, 200, 300]}
				}
			}
		}
	},
	genemind: {
		name: "GeneMind",
		instruments: {
			"FastaSeq S": {
				flowcells: {
					"FCL": {reads_millions: 20.0, cycles: [100, 300]},
					"FCM": {reads_millions: 40.0, cycles: [100, 300]}
				}
			},
			"FastaSeq 300 / Геноскан 3700": {
				flowcells: {
					"FCL": {reads_millions: 50.0, cycles: [100]},
					"FCM": {reads_millions: 125.0, cycles: [150, 300]},
					"FCH": {reads_millions: 200.0, cycles: [150, 300]},
					"FCP": {reads_millions: 500.0, cycles: [150, 300]},
					"FCX": {reads_millions: 100.0, cycles: [400, 500, 600]}
				}
			},
			"GenoLab M / Геноскан 4000": {
				flowcells: {
					"FCM": {reads_millions: 250.0, cycles: [150, 300]},
					"FCH": {reads_millions: 500.0, cycles: [150, 300]}
				}
			},
			"SurfSeq 5000 / Геноскан 5000": {
				flowcells: {
					"FCM": {reads_millions: 500.0, cycles: [300]},
					"FCH": {reads_millions: 2000.0, cycles: [300]},
					"FCP": {reads_millions: 3600.0, cycles: [300]}
				}
			},
			"SurfSeq Q / Геноскан 6000": {
				flowcells: {
					"FCM": {reads_millions: 11700.0, cycles: [50, 100, 200, 300]},
					"FCH": {reads_millions: 23300.0, cycles: [50, 100, 200, 300]}
				}
			}
		}
	}
};
export const readLengths = [50, 75, 100, 150, 200, 250, 300, 400];
export const modes = [
  { value: "SE", label: "Single End (SE)" },
  { value: "PE", label: "Paired End (PE)" }
];