// src/screens/Terms.js
// Plain-English Terms of Service. Public page used as the EULA URL on the
// Intuit Developer production-app form and for general professional polish.

import React from 'react';
import { Box, Container, Typography } from '@mui/material';

const LAST_UPDATED = 'May 24, 2026';

export default function Terms() {
  return (
    <Box sx={{ bgcolor: '#fff', minHeight: '100vh', py: { xs: 4, md: 6 } }}>
      <Container maxWidth="md">
        <Typography variant="h4" sx={{ fontWeight: 900, mb: 1 }}>Terms of Service</Typography>
        <Typography variant="body2" sx={{ color: '#666', mb: 4 }}>Last updated: {LAST_UPDATED}</Typography>

        <Section title="1. About Joint Printing">
          Joint Printing is a custom screen-printing and merchandise business. These terms apply
          to anyone who uses jointprinting.com, places an order with us, or interacts with our
          quoting and approval tools.
        </Section>

        <Section title="2. Quotes and orders">
          Quotes are valid for the duration shown on the quote (default 7 days) unless explicitly
          extended in writing. Once you approve a quote — either by replying to the email or
          clicking Approve on the linked approval page — that approval is binding and we begin
          production. Changes after approval may delay turnaround and incur additional charges.
        </Section>

        <Section title="3. Payments">
          Invoices are issued through QuickBooks. Payment methods and any associated surcharges
          (Credit Card 2.99%, ACH 1%, Venmo 1.9% + $0.10) are listed on each confirmation page.
          Production may not begin until the agreed deposit is received unless otherwise stated.
        </Section>

        <Section title="4. Production and turnaround">
          Standard turnaround is communicated per project. Rush options are available when
          capacity allows. Delays caused by client-side changes, art revisions, blank availability,
          or shipping carrier issues are not the responsibility of Joint Printing.
        </Section>

        <Section title="5. Approvals">
          A signed proof or approval through our online approval link means the client has
          reviewed and accepted the mockup, sizes, colors, quantities, and price. Once approved,
          the order locks for production. Reprints due to client-supplied errors are billed
          separately.
        </Section>

        <Section title="6. Intellectual property">
          You retain all rights to artwork you supply. By submitting artwork to Joint Printing
          you confirm you have the right to reproduce it. Mockups and design work created by
          Joint Printing remain ours until the related invoice is paid in full.
        </Section>

        <Section title="7. Liability">
          Joint Printing's liability for any claim is limited to the value of the order in
          question. We are not responsible for indirect or consequential damages.
        </Section>

        <Section title="8. Contact">
          Questions: <a href="mailto:nate@jointprinting.com" style={{ color: '#1a3d2b' }}>nate@jointprinting.com</a>.
        </Section>
      </Container>
    </Box>
  );
}

function Section({ title, children }) {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>{title}</Typography>
      <Typography variant="body1" sx={{ color: '#222', lineHeight: 1.65 }}>{children}</Typography>
    </Box>
  );
}
