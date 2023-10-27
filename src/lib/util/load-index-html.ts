import fs from 'fs/promises';
import { IUnleashConfig } from '../server-impl';
import { rewriteHTML } from './rewriteHTML';
import path from 'path';
import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

export async function loadIndexHTML(
    config: IUnleashConfig,
    publicFolder: string,
): Promise<string> {
    const { cdnPrefix, baseUriPath = '' } = config.server;

    const cleanConfig = {
        KEEP_CONTENT: true,
        ALLOWED_TAGS: [
            '!DOCTYPE',
            'html',
            'head',
            'title',
            'meta',
            'link',
            'body',
            'div',
            'script',
            'style',
        ],
        ALLOWED_ATTR: [
            'charset',
            'lang',
            'rel',
            'href',
            'http-equiv',
            'name',
            'content',
            'type',
            'crossorigin',
            'src',
            'id',
            'edge',
            'initial-scale',
            'family',
            'wght',
            'display',
            'viewport',
            'description',
        ],
        FORCE_BODY: true,
    };

    const filePath = path.resolve(publicFolder, 'index.html');
    const fileContents = await fs.readFile(filePath, 'utf-8');

    const cleanHTML = DOMPurify.sanitize(fileContents, cleanConfig).toString();

    return rewriteHTML(cleanHTML, baseUriPath, cdnPrefix);
}
