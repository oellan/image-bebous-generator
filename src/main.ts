import {createImage} from './CK';

const formElement = document.getElementById('generator-form')! as HTMLFormElement;
const gradientPreview = formElement.querySelector('#gradient-preview')! as HTMLDivElement;
const startColorInput = formElement.querySelector('#start_color')! as HTMLInputElement;
const endColorInput = formElement.querySelector('#end_color')! as HTMLInputElement;
const imageUrlInput = formElement.querySelector('#image_url')! as HTMLInputElement;
startColorInput.addEventListener('change', updateGradientPreview);
endColorInput.addEventListener('change', updateGradientPreview);
imageUrlInput.addEventListener('change', updateImagePreview);
formElement.addEventListener('submit', async (evt) => {
    evt.preventDefault();
    const data = Object.fromEntries([...new FormData(formElement)]) as { [k: string]: string };
    console.log(data);
    await createImage({
        imageUrl: data['image_url'],
        contentXml: data['content_xml'],
        startColor: toRGB(data['start_color']),
        endColor: toRGB(data['end_color']),
    });
});

function updateGradientPreview() {
    const start = startColorInput.value;
    const end = endColorInput.value;
    gradientPreview.style.background = `linear-gradient(to bottom right, ${start}, ${end})`;
}

function updateImagePreview() {
    try {
        gradientPreview.style.setProperty('--image-url', `url(${new URL(imageUrlInput.value).toString()})`);
    } catch (e: unknown) {
        gradientPreview.style.removeProperty('--image-url');
    }
}

function toRGB(hex: string): [number, number, number] {
    const [_, r, g, b] = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/gi.exec(hex)!;
    return [
        Number.parseInt(r, 16),
        Number.parseInt(g, 16),
        Number.parseInt(b, 16)];
}

updateGradientPreview();
updateImagePreview();

// createImage()
