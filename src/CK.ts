import type {Canvas, CanvasKit, EmbindObject} from 'canvaskit-wasm';
import CanvasKitInit from 'canvaskit-wasm/bin/profiling/canvaskit.js';
import CanvasKitWasm from 'canvaskit-wasm/bin/profiling/canvaskit.wasm?url';
import WorkSansRegularUrl from './font/WorkSans-Medium.ttf';
import WorkSansBoldUrl from './font/WorkSans-Bold.ttf';
import EmojiFontUrl from './font/NotoColorEmoji-Regular.ttf';

type ColorComponents = [number, number, number]; // R G B 0-255
type FetchAll = [CanvasKit, ArrayBuffer, ArrayBuffer, ArrayBuffer, ArrayBuffer]

const BORDER_THICKNESS = 96

const canvasElement = document.getElementById('app')! as HTMLCanvasElement;

type CreateImageArg = {
    imageUrl: string,
    contentXml: string,
    startColor: ColorComponents,
    endColor: ColorComponents,
}

export async function createImage(args: CreateImageArg) {
    return Promise.all([
        CanvasKitInit({
            locateFile: (): string => CanvasKitWasm,
        }),
        fetch(args.imageUrl)
            .then((r) => r.arrayBuffer()),
        fetch(WorkSansRegularUrl)
            .then((r) => r.arrayBuffer()),
        fetch(WorkSansBoldUrl)
            .then((r) => r.arrayBuffer()),
        fetch(EmojiFontUrl)
            .then((r) => r.arrayBuffer()),
    ]).then(async ([
                       CanvasKit,
                       backgroundImageBuffer,
                       WorkSansRegularBuffer,
                       WorkSansBoldBuffer,
                       EmojiFontBuffer,
                   ]: FetchAll) => {
        const backgroundImage = CanvasKit.MakeImageFromEncoded(backgroundImageBuffer)!;
        const surface = CanvasKit.MakeWebGLCanvasSurface(canvasElement)!;

        const shadowPaint = new CanvasKit.Paint;
        shadowPaint.setColor(CanvasKit.BLACK);
        shadowPaint.setMaskFilter(CanvasKit.MaskFilter.MakeBlur(
            CanvasKit.BlurStyle.Normal,
            5,
            true,
        ));
        const transparentPaint = new CanvasKit.Paint;
        transparentPaint.setColor(CanvasKit.TRANSPARENT);

        const fontMgr = CanvasKit.FontMgr.FromData(WorkSansRegularBuffer, WorkSansBoldBuffer, EmojiFontBuffer)!;
        const regularStyle = new CanvasKit.ParagraphStyle({
            textStyle: {
                fontFamilies: ['Work Sans', 'Noto Color Emoji'],
                color: CanvasKit.WHITE,
                fontSize: 150,
                fontStyle: {
                    weight: CanvasKit.FontWeight.Medium,
                },
            },
            textAlign: CanvasKit.TextAlign.Center,
        });

        const paragraphBuilder = CanvasKit.ParagraphBuilder.Make(regularStyle, fontMgr);
        const shadowParagraphBuilder = CanvasKit.ParagraphBuilder.Make(regularStyle, fontMgr);

        const domParser = new DOMParser();
        const doc = domParser.parseFromString(`<doc>${args.contentXml}</doc>`, 'text/xml');
        const lines = doc.querySelectorAll('line') as NodeListOf<Element>;
        lines.forEach((line, index) => {
            const lineChildren = line.childNodes;
            lineChildren.forEach((lineChild) => {
                if (lineChild.nodeName === 'br') {
                    paragraphBuilder.addText('\n');
                    shadowParagraphBuilder.addText('\n');
                    return;
                }
                const lineFragments = (lineChild.textContent ?? '').split(/(\p{Emoji}+)/gu)
                    .filter((s) => s.length > 0)
                    .map((s) => ({
                        text: s,
                        isEmoji: s.match(/\p{Emoji}+/u) != null,
                    }));
                if (lineFragments.length === 0) return;
                lineFragments.forEach(({text, isEmoji}) => {
                    if (isEmoji) {
                        paragraphBuilder.addText(text);
                        shadowParagraphBuilder.pushStyle(new CanvasKit.TextStyle({
                            ...regularStyle.textStyle,
                            color: CanvasKit.TRANSPARENT,
                        }));
                        shadowParagraphBuilder.addText(text);
                        shadowParagraphBuilder.pop();
                        return;
                    }
                    const isBold = lineChild.nodeName === 'bold';
                    shadowParagraphBuilder.pushPaintStyle(new CanvasKit.TextStyle({
                            ...regularStyle.textStyle,
                            fontStyle: {
                                weight: isBold ? CanvasKit.FontWeight.ExtraBold : CanvasKit.FontWeight.Medium,
                            },
                        }),
                        shadowPaint,
                        transparentPaint);
                    paragraphBuilder.pushStyle(new CanvasKit.TextStyle({
                        ...regularStyle.textStyle,
                        fontStyle: {
                            weight: isBold ? CanvasKit.FontWeight.ExtraBold : CanvasKit.FontWeight.Medium,
                        },
                    }));
                    paragraphBuilder.addText(text);
                    shadowParagraphBuilder.addText(text);
                    paragraphBuilder.pop();
                    shadowParagraphBuilder.pop();
                });
            });
            if (index < lines.length - 1) {
                paragraphBuilder.addText('\n\n');
                shadowParagraphBuilder.addText('\n\n');
            }
        });

        const paragraph = paragraphBuilder.build();
        const shadowParagraph = shadowParagraphBuilder.build();
        paragraph.layout(canvasElement.width - 2 * BORDER_THICKNESS);
        shadowParagraph.layout(canvasElement.width - 2 * BORDER_THICKNESS);

        const transparentBlurPaint = new CanvasKit.Paint;
        transparentBlurPaint.setColor(CanvasKit.Color(0, 0, 0, 1));
        transparentBlurPaint.setImageFilter(CanvasKit.ImageFilter.MakeBlur(5, 5, CanvasKit.TileMode.Clamp, null));

        const gradientShader = CanvasKit.Shader.MakeLinearGradient(
            [
                surface.height(),
                surface.width()],
            [0, 0],
            [
                CanvasKit.Color(...args.startColor),
                CanvasKit.Color(...args.endColor)],
            null,
            CanvasKit.TileMode.Clamp,
        );
        const gradientShaderAlpha = CanvasKit.Shader.MakeLinearGradient(
            [
                surface.height(),
                surface.width()],
            [0, 0],
            [
                CanvasKit.Color(...args.startColor, .5),
                CanvasKit.Color(...args.endColor, .5)],
            null,
            CanvasKit.TileMode.Clamp,
        );
        surface.drawOnce((canvas: Canvas) => {
            const gradientPaint = new CanvasKit.Paint;
            gradientPaint.setShader(gradientShader);
            const gradientPaintAlpha = new CanvasKit.Paint;
            gradientPaintAlpha.setShader(gradientShaderAlpha);

            const pictureClipRect = CanvasKit.XYWHRect(
                BORDER_THICKNESS,
                BORDER_THICKNESS,
                surface.width() - 2 * BORDER_THICKNESS,
                surface.height() - 2 * BORDER_THICKNESS);
            canvas.drawRect(
                CanvasKit.LTRBRect(0, 0, surface.width(), surface.height()),
                gradientPaint,
            );

            const dimension = backgroundImage.width() < backgroundImage.height() ? 'width' : 'height';
            const ratio = backgroundImage[dimension]() / (surface[dimension]() - BORDER_THICKNESS);

            isolated(canvas, () => {
                canvas.clipRect(
                    pictureClipRect,
                    CanvasKit.ClipOp.Intersect,
                    true);

                const dw = (float(backgroundImage.width() / ratio) - (surface.width() - BORDER_THICKNESS)) / 2;
                const dh = (float(backgroundImage.height() / ratio) - (surface.height() - BORDER_THICKNESS)) / 2;

                canvas.drawImageRect(
                    backgroundImage,
                    CanvasKit.XYWHRect(0, 0, backgroundImage.width(), backgroundImage.height()),
                    CanvasKit.XYWHRect(-dw, -dh, backgroundImage.width() / ratio, backgroundImage.height() / ratio),
                    transparentBlurPaint,
                );
            });

            isolated(canvas, () => {
                canvas.clipRect(
                    pictureClipRect,
                    CanvasKit.ClipOp.Intersect,
                    true);
                canvas.drawRect(
                    pictureClipRect,
                    gradientPaintAlpha);
            });

            isolated(canvas, () => {
                const paragraphShadowOffset = 12;
                canvas.drawParagraph(shadowParagraph, BORDER_THICKNESS + paragraphShadowOffset * .8, (canvasElement.height - paragraph.getHeight()) / 2 + paragraphShadowOffset * 1.5);
                canvas.drawParagraph(paragraph, BORDER_THICKNESS, (canvasElement.height - paragraph.getHeight()) / 2);
            });

            console.log('finished');
            canvasElement.style.removeProperty('display');

            deleteAll(
                gradientPaint,
                gradientPaintAlpha,
                gradientShader,
                gradientShaderAlpha,
                backgroundImage,
                shadowParagraphBuilder,
                paragraphBuilder,
                paragraph,
                shadowParagraph,
            );
        });
    })
        .catch((e: TypeError) => {
            canvasElement.remove();
            const errorElement = document.createElement('div');
            errorElement.style.color = 'red';
            errorElement.innerText = `${e.message}`;
            document.body.append(errorElement);
            console.dir(e);
        });
}

function isolated(canvas: Canvas, cb: () => void) {
    canvas.save();
    cb();
    canvas.restore();
}

function float(n: number): number {
    return Number.parseFloat(n.toFixed(5));
}

function deleteAll(...resources: EmbindObject<any>[]) {
    resources.forEach((res) => res.delete());
}
