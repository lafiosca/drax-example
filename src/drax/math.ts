import { DraxViewMeasurements } from './types';

export const clipMeasurements = (
	vm: DraxViewMeasurements,
	cvm: DraxViewMeasurements,
): DraxViewMeasurements | undefined => {
	let {
		width,
		height,
		x: x0,
		y: y0,
	} = vm;
	let x1 = x0 + width;
	let y1 = y0 + width;
	const {
		width: cwidth,
		height: cheight,
		x: cx0,
		y: cy0,
	} = cvm;
	const cx1 = cx0 + cwidth;
	const cy1 = cy0 + cheight;
	if (x0 >= cx1 || x1 <= cx0 || y0 >= cy1 || y1 <= cy0) {
		return undefined;
	}
	if (x0 < cx0) {
		x0 = cx0;
		width -= cx0 - x0;
	}
	if (x1 > cx1) {
		x1 = cx1;
		width -= x1 - cx1;
	}
	if (y0 < cy0) {
		y0 = cy0;
		height -= cy0 - y0;
	}
	if (y1 > cy1) {
		y1 = cy1;
		height -= y1 - cy1;
	}
	return {
		width,
		height,
		x: x0,
		y: y0,
	};
};

export const isPointInside = (
	x: number,
	y: number,
	{
		width,
		height,
		x: mx,
		y: my,
	}: DraxViewMeasurements,
): boolean => (x >= mx && y >= my && x <= mx + width && y <= my + height);
