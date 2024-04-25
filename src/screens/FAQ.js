import * as React from 'react';
import { Box, Stack, useMediaQuery } from '@mui/material';
import Typography from '../modules/components/Typography';
import Faq from "react-faq-component";
import '@fontsource/work-sans';

function FAQ() {
    const mobile = useMediaQuery("(max-width: 800px)");
    const textStyle={fontSize: mobile ? 18 : 20,fontFamily: "'Work Sans', sans-serif",}
    const data = {
        rows: [
            {
                title: <span style={textStyle}><b>What services do you offer?</b></span>,
                content: `We specialize in connecting suppliers with printers to fulfill client orders, offering a range of services from product design to complete print solutions.`,
            },
            {
                title: <span style={textStyle}><b>How do I place an order?</b></span>,
                content:
                    "You can place an order by visiting our Products page, selecting the items you need, and submitting your design requirements through our Submit a Free Custom Design form. From there, a personal agent will contact you for the next steps.",
            },
            {
              title: <span style={textStyle}><b>What is the turnaround time for an order?</b></span>,
              content: `The standard turnaround time is 2-3 weeks from the confirmation of your order. If you need a faster turnaround, please contact us to discuss expedited options.`,
            },
            {
              title: <span style={textStyle}><b>Do you offer discounts for bulk orders?</b></span>,
              content: `Yes, we offer volume discounts on large orders. Contact us with your order details, and we will provide you with a customized quote.`,
            },
            {
              title: <span style={textStyle}><b>Can I see a mockup of my order before it goes to print?</b></span>,
              content: `Absolutely! We provide a digital proof for your approval within 24 hours of receiving your design request. Production will only start once we have your final approval.
              `,
            },
            {
              title: <span style={textStyle}><b>Do you offer international shipping?</b></span>,
              content: `Currently, we only operate and ship within the United States. For special international requests, please contact our support team.`,
            },
            {
              title: <span style={textStyle}><b>How can I track my order?</b></span>,
              content: `Once your order is shipped, we will provide you with a tracking number via email. You can use this number to track your order’s progress to delivery.`,
            },
        ],
      };
    
      const styles = {
          // bgColor: 'white',
          bgColor: `transparent`,
          titleTextColor: "black",
          rowTitleColor: "black",
          // rowContentColor: 'grey',
          // arrowColor: "red",
      };
    
      const config = {
          // animate: true,
          // arrowIcon: "V",
          // tabFocus: true
      };

  return (
    <Stack alignItems="center" spacing={2} p={6}>
        {mobile ? <Typography variant="h4" align="center" gutterBottom> Frequently Asked Questions </Typography> :
        <Typography variant="h2" align="center" gutterBottom> Frequently Asked Questions </Typography> }
        <Box width="80%" pb="10vh" pt={2}>
            <Faq
            data={data}
            styles={styles}
            config={config}
            />
        </Box>
    </Stack>
  );
}

export default FAQ;
