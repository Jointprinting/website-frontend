// src/screens/FAQ.js
import * as React from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import MuiTypography from '@mui/material/Typography';
import Typography from '../modules/components/Typography';

function FAQ() {
  const faqs = [
    {
      q: 'What kinds of products can you source?',
      a: 'Most apparel (tees, crews, hoodies, hats) plus bags, drinkware, and a wide range of promo items. If it can be printed or embroidered, there’s a good chance we can find it.',
    },
    {
      q: 'Is there a minimum order quantity?',
      a: 'Our sweet spot is 50+ units per design. We can sometimes flex lower depending on the item and print method, but pricing is always better once you hit real “run” numbers.',
    },
    {
      q: 'How long does a typical order take?',
      a: 'Most projects land in the 3–4 week range from approved mockups and payment, depending on decoration method and stock. If you have a hard date, we’ll work backward and tell you honestly what’s realistic.',
    },
    {
      q: 'Can you help with design or just printing?',
      a: 'Both. If you already have art, we’ll prep it for production. If you just have a logo and a half-formed idea, we can help translate that into a clean set of merch concepts.',
    },
    {
      q: 'How does pricing work?',
      a: 'Pricing is based on blank brand, decoration method, number of print locations, and quantity. We send tiered quotes (e.g., 50 / 100 / 150 units) so you can see where the best value is.',
    },
    {
      q: 'What’s the best way to get started?',
      a: 'Hit “Get your free mockup & quote” on the homepage, pick a few products, and send us your art or ideas. We’ll come back with mockups, recommendations, and clear next steps.',
    },
  ];

  return (
    <Box bgcolor="#f5f5f5" py={8}>
      <Container maxWidth="md">
        <Typography
          variant="overline"
          align="center"
          sx={{ letterSpacing: 3, color: 'text.secondary', mb: 1 }}
        >
          FAQ
        </Typography>
        <Typography
          variant="h4"
          component="h1"
          align="center"
          sx={{ mb: 4 }}
        >
          Common questions about working with us
        </Typography>

        {faqs.map((item, idx) => (
          <Accordion
            key={idx}
            disableGutters
            sx={{
              mb: 1.5,
              borderRadius: 2,
              '&:before': { display: 'none' },
              border: '1px solid',
              borderColor: 'divider',
              overflow: 'hidden',
            }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <MuiTypography fontWeight={600}>{item.q}</MuiTypography>
            </AccordionSummary>
            <AccordionDetails>
              <MuiTypography color="text.secondary">
                {item.a}
              </MuiTypography>
            </AccordionDetails>
          </Accordion>
        ))}
      </Container>
    </Box>
  );
}

export default FAQ;
