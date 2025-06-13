import qrcode from 'qrcode';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { Jimp } from 'jimp';
import pdf from 'pdf-poppler';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const outputDirectory = path.join(__dirname, 'qrcodes');

async function clearFolder(folderPath) {
    try {
        const files = fs.readdirSync(folderPath);
        for (const file of files) {
            const filePath = path.join(folderPath, file);
            if (fs.lstatSync(filePath).isFile()) {
                fs.unlinkSync(filePath);
                console.log(`🗑️ Archivo eliminado: ${file}`);
            }
        }
        console.log('✅ Todos los archivos han sido eliminados de la carpeta.');
    } catch (err) {
        console.error('❌ Error al limpiar la carpeta:', err);
    }
}

async function convertPdfToImages(pdfPath) {
    const pdfFileName = path.basename(pdfPath, path.extname(pdfPath)); // ejemplo: PDF_prueba
    const outputFolder = path.join(outputDirectory, pdfFileName);

    // Crear carpeta de salida si no existe
    if (!fs.existsSync(outputFolder)) {
        fs.mkdirSync(outputFolder, { recursive: true });
        console.log(`📂 Carpeta creada: ${outputFolder}`);
    }

    const options = {
        format: 'png',
        out_dir: outputFolder,
        out_prefix: 'page',
        page: null // procesa todas las páginas
    };

    try {
        await pdf.convert(pdfPath, options);
        console.log(`✅ PDF convertido en imágenes en: ${outputFolder}`);
    } catch (error) {
        console.error('❌ Error convirtiendo PDF:', error);
    }
}


async function generateQrCode(outputFileName, stringToEncode) {
    const outputPath = path.join(outputDirectory, outputFileName);

    if (!fs.existsSync(outputDirectory)) {
        fs.mkdirSync(outputDirectory, { recursive: true });
        console.log(`Directory '${outputDirectory}' created.`);
    }

    try {
        await qrcode.toFile(outputPath, stringToEncode, {
            errorCorrectionLevel: 'H',
            type: 'image/png',
            quality: 0.92,
            margin: 4,
            width: 300,
            color: {
                dark: '#000000FF',
                light: '#FFFFFFFF'
            }
        });
        console.log(`✅ QR code generated at: ${outputPath}`);
    } catch (err) {
        console.error(`❌ Error generating QR:`, err);
    }
}

async function generateAllQrCodes() {
    const promises = [];

    for (let index = 0; index < 30; index++) {
        const stringToEncode = "QR_numero_" + index;
        const outputFileName = `${index}.png`;
        promises.push(generateQrCode(outputFileName, stringToEncode));
    }

    await Promise.all(promises);
}


async function readQrCode(filePath) {
    try {
        const image = await Jimp.read(filePath);
        const imageData = {
            data: new Uint8ClampedArray(image.bitmap.data),
            width: image.bitmap.width,
            height: image.bitmap.height
        };

        const { default: jsQR } = await import('jsqr');
        const decoded = jsQR(imageData.data, imageData.width, imageData.height);

        if (decoded) {
            return decoded.data;
        }
        throw new Error('QR code not detected');
    } catch (err) {
        // No throw here, handle error outside if you want
        throw err;
    }
}

function sanitizeFileName(name) {
    // Elimina caracteres no válidos para nombres de archivo
    return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '').replace(/\s+/g, '_');
}

async function renameImg(oldPath, newName) {
    const dir = path.dirname(oldPath); // directorio actual
    const sanitizedNewName = sanitizeFileName(newName); // limpieza del nombre
    const newPath = path.join(dir, sanitizedNewName + '.png'); // nuevo path con extensión .png

    try {
        await fs.promises.rename(oldPath, newPath);
        console.log(`🔄 Imagen renombrada: '${path.basename(oldPath)}' → '${path.basename(newPath)}'`);
    } catch (err) {
        console.error(`❌ Error renombrando '${oldPath}':`, err);
    }
}

async function readAllQRCodesInFolder(folderPath) {
    const foundQRCodes = [];
    const noQRCodes = [];

    try {
        const files = fs.readdirSync(folderPath);
        for (const file of files) {
            const fullPath = path.join(folderPath, file);

            // Filtra solo archivos .png
            if (path.extname(file).toLowerCase() !== '.png') continue;

            try {
                const qrContent = await readQrCode(fullPath);
                console.log(`📦 QR encontrado en '${file}':`, qrContent);

                await renameImg(fullPath, qrContent);

                foundQRCodes.push({
                    originalFile: file,
                    newFile: sanitizeFileName(qrContent) + '.png',
                    qrContent: qrContent
                });
            } catch (err) {
                console.log(`⚠️ No QR encontrado en '${file}', se continúa...`);
                noQRCodes.push(file);
            }
        }
    } catch (err) {
        console.error('❌ Error leyendo la carpeta:', err);
    }

    return {
        foundQRCodes,
        noQRCodes
    };
}


(async () => {
    await convertPdfToImages("PDF_prueba");
    // await clearFolder(outputDirectory);
    // await generateAllQrCodes();
    // const result = await readAllQRCodesInFolder(outputDirectory);
    // console.log('✅ Resumen de lectura QR:');
    // console.log('Con QR detectado:', result.foundQRCodes);
    // console.log('Sin QR detectado:', result.noQRCodes);
})();
