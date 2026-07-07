Please use react + fastapi to finish this project

# Authorization

We first use clerk to do authorization.

If signed in, then default to page; otherwise you need to sign in.

# Home Page

## Navigation

Put a navigation panel on top. 

- left to the middle we have our logo "CRISPR_Database"
- right to the middle we have navigation bar as follows:
  - Home
  - Analysis. If your cursor is on it and it will show drop bar:
    - Blastp
    - Embedding Search
    - Structure Module
  - Search
  - Contact
  - Logout

## Main Content

Below shows the main content

### Introduction to CRISPR Database

Here leaves blanks first. I will draw a CRISPR with mechanism to put it here

### Metric Cards

Metric cards with below info

- How many Cas Operons we have
- How many genome/contigs we have
- How many countries they are derived from
- How many CRISPR-related proteins we have

### Pie chart

shows distribution of CRISPR classes, types and subtypes.

Show how many 

### Global map

With a global map we shows our city distribution.

Requirement: All above description just use synthetic data first, because later we will use our backend database, but in initial stage just shows the example.