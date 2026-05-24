// src/screens/Privacy.js
// Public Privacy Policy page. Used as the Privacy URL on the Intuit
// Developer production-app form and disclosed at the bottom of the site.

import React from 'react';
import { Box, Container, Typography } from '@mui/material';

const LAST_UPDATED = 'May 24, 2026';

export default function Privacy() {
  return (
    <Box sx={{ bgcolor: '#fff', minHeight: '100vh', py: { xs: 4, md: 6 } }}>
      <Container maxWidth="md">
        <Typography variant="h4" sx={{ fontWeight: 900, mb: 1 }}>Privacy Policy</Typography>
        <Typography variant="body2" sx={{ color: '#666', mb: 4 }}>Last updated: {LAST_UPDATED}</Typography>

        <Section title="What we collect">
          When you submit an inquiry through the contact form, place an order, or open an
          approval link we may collect: your name, business name, email address, phone number,
          shipping address, the content of your messages, and any artwork files you attach.
        </Section>

        <Section title="How we use it">
          We use this information solely to quote, produce, and deliver the work you ask us to
          do, and to follow up about your order. We do not sell your information.
        </Section>

        <Section title="QuickBooks Online connection">
          When the studio admin connects our QuickBooks Online account, we receive an OAuth2
          access token from Intuit. We use that token only to read invoice payment status so
          we can mark projects as paid in our own system. We do not store any of your customer
          data from QuickBooks beyond the invoice number and balance for matching purposes.
        </Section>

        <Section title="How we store it">
          Project records and contact submissions live in our application database, hosted on
          Render. Backups can be downloaded by the studio admin. Approval links use a random
          token and expire after a set number of days (default 7).
        </Section>

        <Section title="Cookies and tracking">
          The public site uses minimal session cookies for the contact form and admin login.
          We do not run third-party advertising trackers.
        </Section>

        <Section title="Your rights">
          You can request access to, correction of, or deletion of any personal data we hold
          about you by emailing the address below. We will respond within a reasonable
          timeframe.
        </Section>

        <Section title="Contact">
          Privacy questions: <a href="mailto:hello@jointprinting.com" style={{ color: '#1a3d2b' }}>hello@jointprinting.com</a>.
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
