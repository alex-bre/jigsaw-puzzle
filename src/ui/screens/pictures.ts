import { catalog, imagesIn, thumbUrl } from '../../content/catalog';
import { currentLanguage, t } from '../../i18n';
import { h, icon } from '../dom';
import { screen, screenHeader, statusBadge, type PictureRef, type ScreenContext } from './context';

/** Category overview plus the player's own photos. */
export function picturesScreen(ctx: ScreenContext): HTMLElement {
  const lang = currentLanguage();
  const fileInput = h('input', {
    type: 'file',
    accept: 'image/*',
    class: 'visually-hidden',
    tabindex: -1,
  });
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    try {
      const photo = await ctx.addPhoto(file);
      ctx.go({ name: 'setup', imageId: photo.id });
    } catch {
      alert(t('photoError'));
    }
  });

  const categories = catalog.categories.map((cat) => {
    const imgs = imagesIn(cat.id);
    return h(
      'button',
      {
        class: 'card',
        type: 'button',
        onclick: () => ctx.go({ name: 'category', categoryId: cat.id }),
      },
      h('img', {
        class: 'card-img',
        src: imgs[0] ? thumbUrl(imgs[0].id) : '',
        alt: '',
        loading: 'lazy',
      }),
      h(
        'span',
        { class: 'card-label' },
        h('strong', {}, cat.title[lang]),
        h('span', { class: 'muted' }, t('picturesCount', { n: imgs.length })),
      ),
    );
  });

  return screen(
    screenHeader(ctx, t('choosePicture')),
    h('div', { class: 'card-grid' }, ...categories),
    h('h2', { class: 'section-title' }, t('myPhotos')),
    h(
      'div',
      { class: 'card-grid' },
      h(
        'button',
        { class: 'card card-add', type: 'button', onclick: () => fileInput.click() },
        h('span', { class: 'card-img card-img-icon' }, icon('photo')),
        h('span', { class: 'card-label' }, h('strong', {}, t('chooseMyPhoto'))),
      ),
      ...ctx.photos.map((p) => pictureCard(ctx, p)),
    ),
    fileInput,
  );
}

/** All pictures of one category. */
export function categoryScreen(ctx: ScreenContext, categoryId: string): HTMLElement {
  const lang = currentLanguage();
  const category = catalog.categories.find((c) => c.id === categoryId);
  const pictures = imagesIn(categoryId)
    .map((img) => ctx.picture(img.id))
    .filter((p): p is PictureRef => !!p);
  return screen(
    screenHeader(ctx, category?.title[lang] ?? t('choosePicture')),
    h('div', { class: 'card-grid' }, ...pictures.map((p) => pictureCard(ctx, p))),
  );
}

function pictureCard(ctx: ScreenContext, p: PictureRef): HTMLElement {
  return h(
    'button',
    { class: 'card', type: 'button', onclick: () => ctx.go({ name: 'setup', imageId: p.id }) },
    h(
      'span',
      { class: 'card-media' },
      h('img', { class: 'card-img', src: p.thumbUrl, alt: '', loading: 'lazy' }),
      statusBadge(ctx, p.id),
    ),
    h('span', { class: 'card-label' }, h('strong', {}, p.title)),
  );
}
