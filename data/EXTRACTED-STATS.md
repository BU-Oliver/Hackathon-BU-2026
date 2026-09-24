# Extracted statistics

Pulled from the two workbooks in this folder. Use these instead of invented
figures — the whole point of the game is that the player's choices are graded
against what actually happened.

---

## 1. Ireland data-centre electricity — CSO
*Source: `BCP Data.xlsx` → sheet "CSO DC Electricity Consumption"*

| Year | DC consumption (GWh) | National total (GWh) | DC share |
| --- | --- | --- | --- |
| 2015 | 1,240 | 24,600 | 5.0% |
| 2017 | 1,762 | 25,725 | 6.8% |
| 2019 | 2,490 | 26,505 | 9.4% |
| 2021 | 4,012 | 28,506 | 14.1% |
| 2022 | 5,273 | 29,824 | 17.7% |
| 2023 | 6,339 | 30,581 | 20.7% |
| 2024 | 6,973 | 31,903 | 21.9% |
| 2025 | 7,663 | 32,986 | 23.2% |

Ten-year growth: **6.2×** on DC demand while national demand rose ~34%.

## 2. Demand forecast — SEAI
*Source: `BCP Data.xlsx` → sheet "SEAI DC Demand Forecast"*

| Year | DC demand (GWh) |
| --- | --- |
| 2024 | 7,779 |
| 2026 | 10,070 |
| 2030 | 12,832 |
| 2033 | 13,889 |

> Note: the "Total National Demand" column in that sheet (~144,000 GWh for
> 2024) is inconsistent with CSO electricity consumption (~31,900 GWh) and
> appears to be a different basis (total energy, not electricity). Use CSO for
> the share figures. Flagged rather than silently reconciled.

## 3. Irish grid carbon intensity — EirGrid
*Source: `BCP Data.xlsx` → sheet "EirGrid CO2 Intensity"*

| Year | gCO₂/kWh |
| --- | --- |
| 1990 | 896.3 |
| 2005 | 635.6 |
| 2015 | 469.9 |
| 2020 | 307.5 |
| 2023 | 253.4 |
| 2024 | **223.7** |

**−75% since 1990.** The grid itself is decarbonising fast, which is the
strongest argument the sector has — and the thing most people don't know.

## 4. Social acceptance survey (n = 200)
*Source: `Social Acceptance of Sustainable Data Centres in Ireland (Responses).xlsx`*

### 4a. Overall attitude to sustainable data centres
| Response | % |
| --- | --- |
| Somewhat supportive | 31.8% |
| Strongly supportive | 23.7% |
| Neutral | 18.2% |
| Somewhat opposed | 15.7% |
| Strongly opposed | 6.6% |
| Not enough information to form a view | 4.0% |

**55.5% supportive · 22.3% opposed · 18.2% neutral · 4% uninformed**

### 4b. What would most increase acceptance
(respondents could choose three; n = 200)

| Condition | Chosen by |
| --- | --- |
| Redirected waste heat to warm local homes/businesses | **53%** |
| Powered entirely by renewable (wind/solar) energy | **48%** |
| Required to create a minimum number of local jobs | 40% |
| Required to fund local community projects/amenities | 38% |
| Subject to independent, publicly reported environmental monitoring | 24% |
| Architecturally designed to complement the local landscape | 24% |
| Operated with regular open days / public information sessions | 15% |
| Supported local schools with STEM programmes | 13% |
| Provided a direct reduction in local energy tariffs/bills | 13% |
| Established a Community Liaison Committee with local decision power | 7% |

Mean importance rating was 4.4–4.7 / 6 for every condition — i.e. **all of them
work**, which is the argument for doing the boring ones.

### 4c. Agreement by capital type (1 = strongly disagree … 5 = strongly agree)
| Capital | Mean |
| --- | --- |
| Financial | 3.00 |
| Social | 2.87 |
| Human | 2.82 |
| Natural | 2.79 |
| Manufactured | 2.78 |

Highest-agreement individual statements:
- 3.11 — "Data centres should be required by law to use 100% renewable energy"
- 3.11 — "People who live near data centres should be actively involved in decisions"
- 3.11 — "Data centres should be required to make financial contributions to local services"
- 3.08 — "I would be more accepting if it demonstrably reduced local energy costs"

Lowest:
- 2.42 — "Data centres place an unacceptable strain on Ireland's national grid"
- 2.49 — "Land used for data centres should be prioritised for housing"
- 2.60 — "Data centres create meaningful, long-term employment for local people"

### 4d. Who people trust for accurate information (1 = most trusted)
| Rank | Source | Mean |
| --- | --- | --- |
| 1 | National government / regulatory bodies | 2.63 |
| 2 | The data centre company itself | 2.83 |
| 3 | Independent environmental scientists / academics | 2.84 |
| 4 | Local government / county council | 2.85 |
| 5 | Environmental NGOs | 2.99 |
| 6 | Local community representatives / residents | 3.12 |

---

## How the game uses this

- **Chat questions** quote the CSO and EirGrid series (the slider answers are
  real Irish figures, not invented ones).
- **Policy decisions** are drawn from the §4b conditions — the exact levers the
  survey says move public opinion.
- **The acceptance meter** is the running score those decisions produce, and it
  is the thing that can get the campus shut down.
- **"What actually happened"** cards cite §1–§3.
