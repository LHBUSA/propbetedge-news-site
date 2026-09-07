/**
 * src/pages/store-policies.js
 *
 * /store/policies — shipping, returns and defects.
 *
 * Written to promise only what a print-on-demand operation can actually
 * honour. Every made-to-order shop that offers free change-of-mind returns
 * ends up either losing money or quietly refusing them, and the second is
 * worse. So the defect and wrong-item cases are unconditional, and the
 * size-choice case says plainly what it can and cannot do.
 *
 * Flagged for legal and customer-service review before checkout opens.
 */
import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';

export async function renderStorePolicies(root, setMeta) {
  if (setMeta) {
    setMeta({
      title: 'Shipping, Returns & Defects — PropBetEdge Store',
      description: 'How PropBetEdge Store orders are made, shipped and replaced. Products are made to order and fulfilled by a third-party production partner.',
      canonical: 'https://propbetedge.ai/store/policies',
    });
  }

  root.innerHTML = `
    ${renderHeader()}
    <main class="st"><div class="st-wrap st-policies">
      <nav class="st-crumbs"><a href="/store">← The collection</a></nav>
      <p class="st-eyebrow">PropBetEdge Store</p>
      <h1>Shipping, returns and defects</h1>

      <section>
        <h2>Made to order</h2>
        <p>PropBetEdge does not hold inventory. Every item is printed or embroidered for you after you order it, by a third-party production partner, and shipped directly to you from their facility. Nothing is warehoused and nothing is printed speculatively.</p>
        <p>That means production time comes before shipping time. Production typically takes a few business days; the exact window is confirmed at checkout once fulfilment is connected.</p>
      </section>

      <section>
        <h2>Shipping</h2>
        <p>Shipping is calculated at checkout from your delivery address. We do not offer blanket free worldwide shipping, because the real cost varies enough by destination and item that promising otherwise would be dishonest.</p>
        <p>Tracking is emailed when your parcel leaves the production facility.</p>
      </section>

      <section>
        <h2>Damaged, defective or wrong item</h2>
        <p>If your item arrives damaged, has a manufacturing defect, or is not what you ordered, we will replace it. Email <a href="mailto:sales@localhomebuyersusa.com">sales@localhomebuyersusa.com</a> within 30 days of delivery with your order number and a photograph of the problem, and we will arrange a replacement at no cost to you.</p>
        <p>This covers print defects, stitching and garment faults, and fulfilment errors. It is the case we control, so it is unconditional.</p>
      </section>

      <section>
        <h2>Size and change of mind</h2>
        <p>Because each item is made for you, we cannot restock a returned garment and resell it, so we do not offer general change-of-mind returns. Please check the size guide on the product page before ordering.</p>
        <p>If you have ordered the wrong size, contact us anyway. We will do what we reasonably can, but we would rather tell you that up front than imply a returns policy we cannot operate.</p>
      </section>

      <section>
        <h2>Cancellations</h2>
        <p>An order can be cancelled before it enters production. Once printing has started it cannot be cancelled, because the item now exists and is specific to your order. Email us as soon as possible if you need to cancel.</p>
      </section>

      <section class="st-legal-flag">
        <p><b>Policy under review.</b> This wording is a first draft and is pending legal and customer-service review before checkout opens. Nothing on this page is a contract term yet.</p>
      </section>

      <p class="st-fine">PropBetEdge is an independent sports intelligence product. Merchandise is produced and shipped by a third-party fulfilment partner.</p>
    </div></main>
    ${renderFooter()}
  `;
}
