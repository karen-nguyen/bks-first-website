# Updating the STEMWorks site

Two ways to change things. Most edits need no code.

## 1. The admin editor (text, photos, cropping)

Open **admin.html** on the live site — e.g. `https://yoursite.netlify.app/admin.html`
(or open `admin.html` from the website folder using a local server).

Sign in: username `stemworks`, password `IBeWorkingAtBuccees`

- **Text** mode — click any headline, paragraph, label, or button and type. Esc keeps the change.
- **Photos** mode — click a photo to select it, then:
  - drag the photo to reframe it,
  - **Replace photo…** (or drop an image on the left panel) to swap it,
  - **Zoom** slider + arrow buttons for fine cropping,
  - description field sets the alt text,
  - sponsor logo cells work the same way.
- Switch pages with the tabs at the top. Edits are kept in your browser as you work.

### Publishing your edits

Edits are private to your browser until you publish them:

1. Press **Save & download** — you get a file called `site-content.json`.
2. Put that file in the `website` folder, next to `index.html` (replace the old one).
3. Re-publish: drag the `website` folder onto https://app.netlify.com/drop
   (or into your existing site's Deploys tab).

That's it — everyone now sees the edits. `site-content.json` holds all text edits,
photo crops, and any replaced photos, for all five pages.

**Discard all unpublished edits** in the left panel resets your browser back to
whatever is currently published.

## 2. The leadership roster (Google Sheet)

Officer names on the Teams and Contact pages are read live from the club Google
Sheet — edit the Sheet and the site updates on its own. Nothing to re-publish.

## 3. Photos as files

Photos live in `website/assets/photos/`. Dropping in a new JPG with the *same
filename* replaces that photo everywhere, permanently, with no admin step.
Filenames: solar-battery, solar-welding, boat-pool-test, boat-team, boat-launch,
boat-course, boat-electronics, robotics-pit, robotics-field, mars-rockets,
drones-arena, drones-airframe, club-team, club-build-night, club-training.

## Notes

- The admin sign-in is a simple gate for keeping visitors out, not real security —
  do not treat the password as protecting anything sensitive.
- Replaced photos are stored inside `site-content.json`. If that file gets very
  large (over a few MB), swap the photo as a file (section 3) instead.
