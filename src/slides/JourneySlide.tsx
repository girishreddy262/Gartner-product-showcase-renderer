import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';
import { Img } from 'remotion';
import type { JourneySegment, JourneyRow } from '../types';
import { tokens } from '../tokens';
import { getPersonaById } from '../assets';

// v3.28b.96: RRIVE framework logo as an inline data URL (matches the editor's
// RRIVE_LOGO_DATA_URL). The renderer previously pointed at a raw absolute
// asset path, which does NOT resolve to the bundled file on Lambda (the
// serveUrl has a path prefix), so the logo rendered broken/missing. Inlining
// the data URL guarantees it renders identically to the editor preview.
const RRIVE_LOGO_DATA_URL = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjE1IiBoZWlnaHQ9IjExNyIgdmlld0JveD0iMCAwIDIxNSAxMTciIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiPgo8cmVjdCB3aWR0aD0iMjE1IiBoZWlnaHQ9IjExNyIgZmlsbD0idXJsKCNwYXR0ZXJuMF80MDY0XzQ0NCkiLz4KPGRlZnM+CjxwYXR0ZXJuIGlkPSJwYXR0ZXJuMF80MDY0XzQ0NCIgcGF0dGVybkNvbnRlbnRVbml0cz0ib2JqZWN0Qm91bmRpbmdCb3giIHdpZHRoPSIxIiBoZWlnaHQ9IjEiPgo8dXNlIHhsaW5rOmhyZWY9IiNpbWFnZTBfNDA2NF80NDQiIHRyYW5zZm9ybT0ic2NhbGUoMC4wMDQ2NTExNiAwLjAwODU0NzAxKSIvPgo8L3BhdHRlcm4+CjxpbWFnZSBpZD0iaW1hZ2UwXzQwNjRfNDQ0IiB3aWR0aD0iMjE1IiBoZWlnaHQ9IjExNyIgcHJlc2VydmVBc3BlY3RSYXRpbz0ibm9uZSIgeGxpbms6aHJlZj0iZGF0YTppbWFnZS9wbmc7YmFzZTY0LGlWQk9SdzBLR2dvQUFBQU5TVWhFVWdBQUFOY0FBQUIxQ0FZQUFBRGRxWFJRQUFBQUNYQklXWE1BQUFzVEFBQUxFd0VBbXB3WUFBQUFBWE5TUjBJQXJzNGM2UUFBQUFSblFVMUJBQUN4and2OFlRVUFBQUFPZEVWWWRGTnZablIzWVhKbEFFWnBaMjFobnJHV1l3QUFFak5KUkVGVWVBSHRuZjExMjdvT3dKRjMzdjgzZDRLeUU5UjNncXRPMEhTQ3FoUGNkSUs0RXpTZElPNEVUU2V3T2tIU0NhdzdRZk1td0JNc0tLWnA2b3VnSmRyQjd4d2xOazE5RXlRSWdpQ0FvaWlLb2lpS29paUtvaWpLaVhFQlNoSWc0bVgxajdhbmk0dUxKMUJPSGhXdW1XQmh5cXZ0WGJVdG9CWXNtOGRxSXlFcnJiU3NFcnpYb0NpS24wcXdGdFgyRzNkc25POWRYSUdpS0lkVXdtRXNRYnJsRm96U3Yxc0NSSitYL0gvakNKY0JSVkVPcVlSanpVSnk1NlRiUXBSYjZibmR3b0dpS0lkUUsrVnJnYmcxczFsWXY5MWE2ZmVnbkF6L0JXVktHcUVoaTJEcFNXOStlN1MrLzIxOUxpb0J5NnIvdEpHeDQ5NDV6aGJjR1V2ZWNMNWZWYjRWS01xNWdyVWg0MEM5YzFxbnRmT2J6ZHI1dm1GQnN2TmY0YTVQdDdIMnlVQlJ6aGtXcE4rMlVEaENjMnVsWng1aCt1Nms1VlorNCtRMTFqR1dvQ2d2RGR3M3cxOVo2ZGVPSUJsTzM3UUkxMEU2N2d3aU9TaktTd0ozcXVLZUFQRnZkaXQxWjZYYlFwUnhtdGVxaUxzeE5BUEtwS2hCWTM1c1kwYlpZZWo0Ulgrd1ZpZU5sZDRZUDk1WmFRWG4rOEo1UC9vTUg0cHkxbENMWkxVNDkxYjZwZE9pTFRqZDdvYzlXUGw5SGg5clZFUEdiR2pMTlQ5MjYxUzBwSU5sbnJmZG4zN1NIOXc1L1RaOGc5cE1iNXYwdC9uVUtYZzYvZ1BLYkxCUTJFSmtDME5tZlM2c3oyODg2UWIyS1R5Q1JYMDI5VXVjRUJXdWVWazQzOXNHajM5Wm4rMFc2bTgyVk56dEgyWW5tRmliNDJuczdGOGRTRlplRExodmFuOXdmbXN6ejd2alhFMGZhKzJrclhGblZWeUNvcndrc04zVXZ2QVpNL2czZy91bStEV25HZlFMV0FhS29neUhoZW5TazM3WjlwdWlLSXFpS0lxaUtJcWlLSXFpS0lxaUtNb1pjWUh6VGFKNzR1MHhsak1wMXE1QUdjZ280ZEJYYnl4RjdDa2VFZDRUVFdjcElIRjRmRzR1SDhpUy8wY3BreVJjQ1BPekZUTGVmb1FXQWk2QWR5RGpiYld0UWNibjZoNldFQW4yMEhnQUdSL0grQlp5UlVXRm5CeUZEZXdxbk9aL0NidUl3T1Q3U08rdWtCWktQbThLSWVTYU1ra3pENHFnTW9scHNzRjZucE1aZVM4NXlpRVBoNkhSYjl1UUNxZDdYOWNveHd3NEQ5MzdEUjRHSWgzREdnV3RMQjZHbVV1RkRZNHRrNWcrZHpqd2hqQ0NjUEZ4MWlnbm12dFJoT3RaOXh5ZkN2UWR4bVdEQVVLRzZRcVh6UjBPS0pPbk1PVWtyN1pOZFRNM01CM2ZRRTZVZmdQV1FwcUJqQjhkeC84SGFwVXpoN2lZYXFOQ3VFRTh1L2dkZWJVOVZQZDEzWlhwbE9aekxiR3V3YWR3U0wwSE9iRTY1Um5JT2JnZjNNM3p1b1hERlZaaVltQkFRVHhCdGpGS3F2djYwcGJoMUNaTFpsQy9xS01LR0hmS0M1RHhOOFRoSGNoNGRDMlgzSktRWUdVd0RVMUJuRkw3bUFycUQzdU5UYWM0RTlsVTIzYzRQajlBQmhrSE1wQ1RnWXk5KzdBRXk4RDBMTTlVd0dqKzNZR1YrbFNuK1dkNC9ObTFLNUFqVWcyeE5zRWJrR0ZIbERJd24yQTFrSUI5Z1BNamQxWGZVNDZoY1hQTWpuSWsxVkNxMG1VZ28zUUMxVkNyWVdCK2JzL1F5RUhjMkYyV1V3OVFjMndWUTZvYUdtRWhrZ3JuOC9WamJSYlBJUTJvQUVvSCsxT0U3dXU1OVRwMTRibzZzbkZqQlhLQ1ZNTklKbmpiU2lpcGlNcHErMVJ0cnkrWTZ2TmYxZllWYWsrR0VESTh6L2dlL3pRZlRsMjRqdXFITnJOcW1JR01aMTlDYnJVTWhFRmpmbjlWeDdxMXJZNmtibFliMWRJa1pDV0VjWTdHaldkRFZveUl1MVE3L2hxWWwvelVZblRTYmNqa3ZZTGpRYjVsR1lSRGxxU1FTTGRTbGJDd1BvY1dZb3JhbTNkbElJR3I3by84TWNrY1BWYUwyTFplUjNBb1hsWGJ2d1B6SHFOTTB2R0tHTzVQT1l3RTZ3WGFOaGdITzE1NkZQY241MXBqdU9Oa01CS1VQNS9NZXRhaG1CSFh1OFF3dmlmeXZLbnNiREFPVzNWOEZyV3dxcW5vNUZUYmxTREh3QkZoVmFnRUdhTlVWNVNiNE8zcEphRXQ0R3JrdEJueTlBanBmMUhyTllYWFRTYzhZeUJXbVh4RmYyYnJjL0dMK3doeXBuZ3hVbC9Ec1FVOEF4bEZoR09OdW1kV2UwT3NxMjY4L05tSVhTWm5OV2h3N2ZvSTZWT0FESU5XMU53QlNQdGJXOEdRdElDQi9hRFFkM2swbzlSWStMNURMYUI3cExDRUVCbERrcWk1MnFBSFhoVlVldUNTVmpLREFZVVA1U2I0SjBzd0RBU0N6cUxvQXdsOVBySDhNR05SZ0V6Z3Q4S1pnbkNWSUdPcWxvOWFnMzhnSEdxTmJnZmt5MENHUGJZbHFiUU1USWVCdFBnZnlOZ0tWd3JqWEFaa1JHbkNCM0FQTW9aMjNLTjVaY0EwL2RFWWJPUGJRenE4QWhuYm9ha1VoT3NOeUpDNktBMGlraTQrUk5YSUlKd250c1Eybklwd0VRYlNRZHBOS2VqUHJNTEY0eEhTRzVHMktHT1FXZzA3K3hZUlRQQS80WFF4a0FCWWo5dEtLNldDL3N3bVhPaGZFWEVzMFVPWTlTQVY1TDZXS3dNWlUxWTBad2VYU2FsTDFxcnh4cGxjdUxDT01IUU50YnVNQVJtZllVSWlxSVo5RXlpbC9TMVh1RXBRZXVFeVNVSVZ0VXpHc0JhK0c5QVovUVBxcHBieUxTQk9YMkExVTVCTDZ1TkpKdnRsNEJrM2kyQ0M5OFVNbk1yWWt4b2ZzTjhGcWltVEM0ZzNGUFRaMXFSaUNOY1ZURDhJV0VJOUJXSU9WaUFUcnJaK1Z3WXlmUDNCMEdFS01vejhDYWRMRHRQejZBYUNQY1VwSjJXMXZiMklGQUk3QUNxd2tuTzNtZVJqZXNFM2hBcFhyUGdmTHdWNnptL2R4Rk1UcmdKcXdTcGhKbGlvcFFQWHZwWStnM0M4aGgzaHRVNnRqWndxcERGNEsvdFRFUzY2OEUvVkRjd3FXQlpSVGZMY1p6VVFUdGYxaEk0RGZrakJXejFobWpLWnQybFJxU3pFME1VS25JNWlHeGhoSVFhZXd0NTNIaXAwdnlHY3ZUNU5oT3QrM2ZaOFVMYUlBMDJXZkQ4ME00YlBlQzZzV2RNRzBsaUlvUTBTSkFwdmNOdlhOVW5CdDdDTEpLMWQ5RkNyUWxCQXVDcTNkZmV4QkVMaXVObzUxa2ZUOFFYWFNoTXRiNnBqOUE1NXNDbDdDV0ZJMWV5cG9RYUpLdGpPOHBtNldrZzNrTVAwc2VLSElIVzdzdnMwR1lRejVEb2s0NEUwdy9pdWJiaUZ4NGdvcFBNU3dpZ2RsNjNVb1RLNXJMWTE5b1RvUGdXMTBJWnF1UGNkS2xBT0U2aUZmQzZwYWtqamRCOGpxRUd2QjZyTU1jSlgwL012WVZkam13akgvR2l2RzNZQ2FxSExDdXErMTBFcmRtckNSV3pObnI2Ym1WSzQrSHlTQXJ2dGR3bXZtY1pXL2hxU2tRdHRTQkNaWTBLdDFtczc0UVNGaXlEVi9PUk44UVIxMEZOUkVTV3FZVFBOUXRMZkdteTE1Tlp0cm9GM0gxUTV2b1h6d0J0ZS9WVGpGbDRuTXNpNUFoa1p5Rnh2aWpHWldmMmExQit6ZzQrSkRLdkU0c2J0bDhhd0ZsSnQyTmNoTmJ5UkYwS3N3VWxxdlFxWWtRaFdRM29lb2NMbHhvRWZCTG5vY0U5Z3p0Yi80NUdOR0RSODBQZHNETlRQbnQ1QkJuRzRCaXVjOWVSeEM3R09TN2ZCT0JqbjJEa0tnWkZnZUx3K0tiY2dZS2JycHJXbXM1N3Jtanh1SWRibFJyb09Odkl4bnZ1MGs2dUZyQXFRcmgxakRDc0ZGNTBWek1NS0JMQ1RhYXc0ZlVNb29BNkxYVUJpV0RFTHBlek5iSmdyS0dnSjlTaTNsQXhtSmxMUTBMRUVxWVF1WE5DcFVNVjRGMjJrNXJybWhaOW5qUDVvMW55WTA2QkJhbzIwOVpMRzM0aUYxTmR3TEFWRWdnbzhMNmhBSm5HNmp4TGlRTytXQ2l1Tnc0bFUyQW1KY1ozUFpYTE9pTHVoRVZwdERLYmhYRnJBdEVRWFpoYXluTWVkM3ZNNXhyYU9sSjlhUVdxbC9pVFY4MksrcVVHamliU3F6Yk9CYW03ZndnSmtFdytKWGgrdlk4TkJRMHVZSnNoS2VleCtDMXZ5dHRZOHJyeWEyZVBOYkhMaXlkcEt2cTZURWFRT3FNTFBJQndhdjl5dWFwT0NjRW1oRjEvQy9OQkxrUVFOSFVvQlJ3QnJ5MnNqUkkzUVBJYlc1czd4aUJKcXJ4UnhYL0hJeExpKzdUT2NWYmg0YlNkNmVSTFZMZ1cxa0tDYWZncmgrb2IxZ3QzVVAyaTc5eEpxSTBMbldCS2JyT2xZVjIzSDRoYVp6dldqenlEQng2TnhvN3puZUFVTW5FWTBBeVhJTWR2am9Kd2NCS0I4ek92YU90Yms0MXpPdmNRWUsrbmlONS9uWVVoZWJPbVBWdW5rcnJQR2NXeXc1VjFqUFRhMXh2SGN0QnhMU2dienZzZnRFRkVLN2svU1pqaVZsb3M0dHRYd2ZrUmVlaTUzeUFQdFdFOE4yUXBWOVRYRTRkanc4WjRGZ285SFRzY2JDT3VuTERHOXFVU0V0Tys0TFpNcENKYzA2SDFLakNuOElUVFcxWEpnZnFwQk4xaTNlTFRGbUhheWJHcDJQbDRPTXBhWVhqQ2NFaUtRZ25CRnFTVlNJT2JhVGg3c09QRC93amhpUDZQWXg1TkdYbzdOMk9mcmtrekxKUzJNZjBCYUhHdGhDRHNPL0xGYnlLa3hUVC9sVEVoR3VFbzRMMVp3SEd5Qm9uN3FPWXdwMmVTUURsR2U3YW5PNTdJeGtCYkhLdmpQd3NWalQ4ZjBCNXlEbEZhWExFSEdLL3B6RHRaQ0F3a1J5WVhHNVlmSCs0SEduczZwOVVwcEFUenBjOTJHelR1SFBsY3Evb1Uyc2Z0ZEIzMHNGcllZSzg4WFVFOTRmY3ZIazc2UHdqb2ViV09HSnhhUUJ0SUt2MjZGVVU0T1FsQStrUHlGanpQcklMSjFQMVFMeHh4UU5oM25DcDNvdDBhUENieEtXMkRZKzFoamkwa2Rodzh3MDcya01JZ2M0LzNka1B2VENtU1VJSWVtSmtoMGJ0dC9iUVV6dzlQL3FVOGtYVnVYS0h1Q2ZxNndEald3aEdGTzBKVDNjNXZ6THdjUmZSdnJlQXkxaURRbVpqcnlOT28wL1YrQkRGSHJ5KytQV2w5Um1Sd2NSa3hKSDl3NXk5Sm1DellOMUpPcWN6L0djeDEzYTRhSmo0Zjk4ZkFmejhTclhsRVVSVkVVUlZFVVJWRVU1WFNaM1ZxSTlYd2VNMklYOGc3L05IQS9zajc5Z3A0MXJLeHI4WGxuZjJxellyWGtKNzY2MDlrN3JwZThMKzZ4ZGx3ZHV5NHlEV0Zjdzc3emNtbXZwOFZXT25mTzFONHNZTisxMFFvczluZmN6VEp1WmkzVFJ2ZFk4ajJzbkhNMEMrOE5tWjFOWHVpRmE4NXZlU2J1dFJ2d1J3LytlZ0loQlk0TEJzeUlEZHp2Uzg5MVpDMzdMVHYyYWVQV3lYZlprWGZKZVpZNEh0K000dC9PdVgwRDY5ZE9IbmZBZEdQOU5uU1c4UVlQSXlCbk9JNE4xZ0lKSGM4a2M1N3J4cFBuRmhMZ0hCeDNoMEtMTjNUTkcvb3dNcjBMZC9BeGcrUHgwL251K3VqNUJrS2ZZK3R4WVhiZHh3cit6Y0R3Q1phVTk4RVdqZ0FNMUl2SzlSNEQ2ekU0MzhEME40N0RPRHN2U2JpSUhOdGRZOXJTRFk1M3Axbmd2ci9qV0hWdkRJVW5MYk0rTHdKK2Izd2pxVEl5bnQ5SlRTNDk2WFRQMzFIbTYwbjdmaG1Rai9LNDEwNEQwVGtrUXFwcklsUE4wemI5djJzVTMxNUliZnVpNGJCdzBBc3A3QVRzWHlqN0NzWjd1dE0rSy82Y1FSamtndFBWYjJoK2N5Tm9iUXNkN21JT3VteWRuYmt2Nld2Wkh2bVpaRTQ2NVgvdkxBN3V0aDcwbWQ3ZkV2eHNGK3UydnVkdzJHZnFiTG13VnZGeko1bWV4Ym1zOXhVSDlPdnpKbVEvVHg1ZmYyUHB5ZmZkeWZQYjgvM1NzMThYZDV5bnp4RjF5Zms2K3hjam44VURwM2YxZWE0NHowUEx2bXZQUHJubjNMNzcrOTF4L3FYbkdCczNVOGN6V1h2U05wak9kSlZuemwwdDlLa25yaFhQd09GcUtWODl4OG1nSDd0VmJZNlpkZVRwNHdicnhiN2R6VldiM0NrdWpWcWFkWng3NGZ4ditObVMvdVN6Q0xMbHJuQ1NxZDgzcHUvbHZxZXUxanB6dnBkUWg4OHVJVEZTVlFzMzZKLzk4Wm1YdnZIaTFLelVhYytkTEw2VjR6UG4reE12RUVjbVpQdWwwM2QzWDVjQ2RrSzFEV1VHKy8ydGtyY01odEdXcjRUOUpWaDloZEhBL2tJVlRaNW5vVUoveTNqUEZjNllBazhDbVRscEMvRDN5OTVZNzRuTzhRNE96elZtbGpYdE82YkNtb3hVaFN1VUxtdGdBZjdKaGU0NFRDTkExQnJZbGtKU2NTNTdQTGVwa05tdElCV3d6TGtHQTVIaFdQVytmcGZkZXRCWTBwT1Y5cWJsV2g3QjMrS1hFSWNyYUY5WGphN3ZzNitGN0tBeGdNU1lPQnFWbDJJdHBKZjJ6VlVkV0hWeDFaZG01dXpLYzV4cjZPWVI5bXRSNnFqYkJmVW5IQSszWmNsZ1gzZ0tKNCtCdzlhbTZLZzgvb1J4aExRbUJZUkZ0dXF5QXM5R3FzSkZoYUR3YkNXRVFRV2MraXF1Y0xpdGxyMkNpQ3NveEpESmN6K2M4OW9VTUE3cVMvaDQzWE5ld2pYL1A4S2hBTHA1dHNMUGxkQ1llL2V0a3hZaVhOU2lyYkhibEYrQ1AzVEFIYVlYN21GZThFald3dXJybGVlNGUxWS9ESnZPbmxuN0gveEdBdHl5WDVzVmJzbnB3ZFpDM3IvUEcrSVN1ejFGOXM2SC92ZVNlYzRiYkMzRWR1K1BybWZTWnVVa2hveVBUY2JacW9Wc3VIQnJPQklzUXgvNEpSa1l6MVhQNzIxcVRaZEJvUFZjV0E4bnRHM1BLbTFQdE4vdExGOVcrZHF1NDhueDdXdHJIVXp6aFQ5LzkrUWJwTnB4Qy9uSjg5T2lZN2ZtSG4zN1hXTkM2dUc1OTdsOEJhbDVjYUZlRTUzdVVCMXJKSWRFaENLMTlhNWpjd1c5YURtT0haNjVyZCszOTZ6WXFPQStQd08xSlpkYURXcUphWE1Gb1lRUmF3dXpjNjFiS2J3YXNGOEJmcXNpVlFCSnFJZm5MbHplbXB4cjNOeEpwdHIycldjcm5IeVhBMnBIbnlBVmNIemFCS2V3UHJlMVhMNXJwdVZiUzA5Nll3anlGZUpQQVdOTzduc2FLaHhMT0x3K0EzNHYrY2s1ZCtFcVBXbHRBOEprVFN6Y0RmenFVZC9MY3d0d2NURk44SldpSmYyeDVYUG52aXdrVk1HVTBNODI3MFhQZ25zZCs0Nm1JM1pqRXVwaEN1TmNWR09XVHRxUWd1amJ6NFVLMHNxVGZ1bW1keFFLU25jdFpjMzFyVnJTM1gxK09KOUwyTDlHNkxqV0xseFZqbndDVjEzNTJ2SzB6WDFpQVh1TjljQXZxZElaN0ZxV3BnOUg5N1R5VkNDMDc2cnRXaXkrZ2ZNdVdidndQWk1uNS9wb2pJLzZYNjdGTW9QcEY0SlhGRVZSRkVWUkZFVlJGRVZSRkVYeDhIL3BSUzhOZWZrbzJBQUFBQUJKUlU1RXJrSmdnZz09Ii8+CjwvZGVmcz4KPC9zdmc+Cg==';

/**
 * Journey slide — pixel-accurate match to the design SVG, WITH camera animation.
 *
 * Canvas: 1920×1080.
 *
 * v3.28b.82: Re-inlined the camera (zoom + pan) animation that was lost in an
 * earlier commit, causing rendered MP4s to be static. The camera math is a
 * 1:1 port of the editor preview (renderJourneySVG in editor.html), so the MP4
 * matches the timeline preview frame-for-frame.
 *
 * Timeline (t = ms from slide start):
 *   0–1000ms (PRE_ROLL): full slide visible, no zoom (scale 1).
 *   1000ms: first active row glow fires; zoom ramp begins.
 *   1000–1700ms (ZOOM_RAMP 700ms): scale 1 → 1.5, focal centers on active row,
 *     header (title/footer/logo) fades out.
 *   every 1400ms (ROW_HOLD): next row activates (glow + camera pans down 700ms).
 *   last 600ms (FADE_OUT): whole slide fades opacity → 0.
 *   startZoomedIn flag: zoom = 1 from frame 0, rows fire immediately.
 */

const ROW_YS = [254.917, 398.592, 543.284, 687.888, 832.58];
const AVATAR_X = 1146.16;
const TICK_X = 1259.88;
const AVATAR_R = 41;

// Camera constants (mirror editor.html renderJourneySVG)
const CW = 1920, CH = 1080;
const ZOOM_SCALE = 1.5;
const FOCAL_X = 1260;
const ZOOM_RAMP_MS = 700;
const PAN_MS = 700;
const FADE_OUT_MS = 600;
const GLOW_IN_MS = 500;
const ROW_HOLD_MS = 1400;
const PRE_ROLL_MS = 1000;

const smooth = (tt: number) => { const c = Math.max(0, Math.min(1, tt)); return c * c * (3 - 2 * c); };

export const JourneySlideNew: React.FC<{ seg: JourneySegment; headerOpacity?: number }> = ({ seg, headerOpacity: headerOpacityProp }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Time within this slide, in ms. The slide's own Sequence makes frame 0 = slide start.
  const t = (frame / fps) * 1000;
  // Slide duration in ms (from the Sequence length).
  const segDurationMs = (durationInFrames / fps) * 1000;

  const rows = seg.rows || [];
  const visibleRows = rows.slice(0, 5);
  const Nrows = visibleRows.length;

  // v3.28b.40: optional flag — start already zoomed in.
  const startZoomedIn = !!(seg.journeyZoom && (seg.journeyZoom as { startZoomedIn?: boolean }).startZoomedIn);

  // Resolve glow state per row (back-compat with seg.highlightUpToRow)
  const N = Math.max(0, Math.min(seg.highlightUpToRow || 0, Nrows));
  const resolvedGlow: string[] = visibleRows.map((row, i) => {
    if (row.glowState) return row.glowState as string;
    if (N === 0) return 'inactive';
    if (i < N - 1) return 'glow-static';
    if (i === N - 1) return 'glow-animate';
    return 'inactive';
  });

  // ---- Per-row glow progress (animate ordinal, fires at PRE_ROLL + ord*ROW_HOLD) ----
  let _animOrd = 0;
  const rowProgress: number[] = visibleRows.map((row, i) => {
    const st = resolvedGlow[i];
    if (st === 'inactive') return 0;
    if (st === 'glow-static') return 1;
    // glow-animate
    const preRoll = startZoomedIn ? 0 : PRE_ROLL_MS;
    const activeAt = preRoll + _animOrd * ROW_HOLD_MS;
    _animOrd++;
    if (t < activeAt) return 0;
    if (t > activeAt + GLOW_IN_MS) return 1;
    return smooth((t - activeAt) / GLOW_IN_MS);
  });

  // ---- Camera transform (zoom + pan) ----
  let scale = 1, txCam = 0, tyCam = 0;
  let headerOpacity = 1, slideOpacity = 1;

  // zoom progress
  let zoomProgress = 0;
  if (startZoomedIn) {
    zoomProgress = 1;
  } else if (t < PRE_ROLL_MS) {
    zoomProgress = 0;
  } else if (t < PRE_ROLL_MS + ZOOM_RAMP_MS) {
    zoomProgress = smooth((t - PRE_ROLL_MS) / ZOOM_RAMP_MS);
  } else {
    zoomProgress = 1;
  }
  headerOpacity = 1 - zoomProgress;
  // fade out last 600ms
  if (t > segDurationMs - FADE_OUT_MS) {
    slideOpacity = Math.max(0, (segDurationMs - t) / FADE_OUT_MS);
  }

  // focal row index over time
  // v3.28b.86: 2 rows frame like 3+ (focal on row 1, not row 0) so the top
  // connector line is not pushed down during zoom (was leaving a gap above it).
  const minCp = Nrows >= 2 ? 1 : 0;
  const maxCp = Nrows >= 3 ? Nrows - 2 : Math.max(0, Nrows - 1);
  const cpAt = (time: number) => {
    let last = 0;
    let ordinal = 0;
    for (let i = 0; i < Nrows; i++) {
      const st = resolvedGlow[i];
      if (st === 'inactive') continue;
      if (st === 'glow-static') { last = Math.max(last, i); continue; }
      const activeAt = (startZoomedIn ? 0 : PRE_ROLL_MS) + ordinal * ROW_HOLD_MS;
      ordinal++;
      if (time >= activeAt) last = Math.max(last, i);
    }
    return Math.max(minCp, Math.min(maxCp, last));
  };

  let focalY = ROW_YS[cpAt(0)] ?? ROW_YS[0];
  let prevCp = cpAt(0);
  let ord = 0;
  for (let i = 0; i < Nrows; i++) {
    const st = resolvedGlow[i];
    if (st !== 'glow-animate') continue;
    const tCp = (startZoomedIn ? 0 : PRE_ROLL_MS) + ord * ROW_HOLD_MS;
    ord++;
    const newCp = cpAt(tCp);
    if (newCp !== prevCp) {
      const targetY = ROW_YS[newCp];
      if (t >= tCp + PAN_MS) {
        focalY = targetY;
      } else if (t >= tCp) {
        focalY = focalY + (targetY - focalY) * smooth((t - tCp) / PAN_MS);
        break;
      } else {
        break;
      }
      prevCp = newCp;
    }
  }

  scale = 1 + (ZOOM_SCALE - 1) * zoomProgress;
  // v3.28b.87: pin focal to at least row 1's Y so the top connector line is not pushed
  // down during zoom (covers 1-row; matches editor preview).
  if (focalY < ROW_YS[1]) focalY = ROW_YS[1];
  const screenFx = (1 - zoomProgress) * FOCAL_X + zoomProgress * (CW / 2);
  const screenFy = (1 - zoomProgress) * focalY + zoomProgress * (CH / 2);
  txCam = screenFx - FOCAL_X * scale;
  tyCam = screenFy - focalY * scale;

  // If Root passes an explicit headerOpacity (legacy zoom-effect fade), respect the
  // lower of the two so an external zoom effect can still hide the header.
  if (typeof headerOpacityProp === 'number') {
    headerOpacity = Math.min(headerOpacity, headerOpacityProp);
  }
  const showHeader = headerOpacity > 0.01;

  // Title lines
  const titleLines = (seg.title || '').split('\n').filter(Boolean);
  const titleStartY = 280;
  const titleLineHeight = 90;
  const lastTitleY = titleStartY + Math.max(0, titleLines.length - 1) * titleLineHeight;
  const footerY = lastTitleY + 60;

  // Connector segments
  const connectorSegments: Array<{ y1: number; y2: number }> = [];
  if (visibleRows.length > 0) {
    connectorSegments.push({ y1: 113.888, y2: ROW_YS[0] - 22 });
    for (let i = 0; i < visibleRows.length - 1; i++) {
      connectorSegments.push({ y1: ROW_YS[i] + 22, y2: ROW_YS[i + 1] - 22 });
    }
    if (!seg.endJourney) {
      const lastIdx = visibleRows.length - 1;
      connectorSegments.push({ y1: ROW_YS[lastIdx] + 22, y2: 966.888 });
    }
  }

  const clipId = `card-clip-${seg.id}`;

  return (
    <svg
      viewBox="0 0 1920 1080"
      width="100%" height="100%"
      style={{ display: 'block', opacity: slideOpacity }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <clipPath id={clipId}>
          <rect x={10} y={113.5} width={1900} height={853} rx={20} />
        </clipPath>
      </defs>

      {/* Static frame — outer navy + inner card. Does NOT zoom/pan. */}
      <rect width={1920} height={1080} fill={tokens.bgOuter} />
      <rect x={10} y={113.5} width={1900} height={853} rx={20} fill="black" fillOpacity={0.2} />

      {/* Clipped content layer with internal camera transform */}
      <g clipPath={`url(#${clipId})`}>
        <g transform={`translate(${txCam.toFixed(2)} ${tyCam.toFixed(2)}) scale(${scale.toFixed(4)})`}>

          {/* Header group (title + footer card + RRIVE logo) — fades with zoom */}
          {showHeader && (
            <g opacity={headerOpacity}>
              {/* v3.28b.84: optional uploaded slide image/logo (left, free position).
                  Inside the header group so it fades out on zoom like the title. */}
              {seg.slideImage && seg.slideImage.url && (
                <image
                  x={seg.slideImage.x ?? 100}
                  y={seg.slideImage.y ?? 600}
                  width={seg.slideImage.width ?? 300}
                  height={seg.slideImage.height ?? 120}
                  href={seg.slideImage.url}
                  preserveAspectRatio="xMidYMid meet"
                />
              )}
              {titleLines.map((line, idx) => (
                <text
                  key={idx}
                  x={100}
                  y={titleStartY + idx * titleLineHeight}
                  fill="white"
                  fontFamily="Satoshi, system-ui, sans-serif"
                  fontSize={64}
                  fontWeight={700}
                >
                  {line}
                </text>
              ))}

              {seg.footerCard && seg.footerCard.enabled && (() => {
                const bodyLines = (seg.footerCard.body || '').split('\n');
                const numLines = Math.max(1, bodyLines.length);
                const labelHeight = seg.footerCard.label ? 60 : 20;
                const bodyHeight = numLines * 40 + 10;
                const totalH = labelHeight + bodyHeight + 30;
                return (
                  <g>
                    <rect x={100} y={footerY} width={403} height={totalH} rx={15} fill={tokens.blueNote} />
                    {seg.footerCard.label && (
                      <text
                        x={130} y={footerY + 48}
                        fill="rgba(255,255,255,0.65)"
                        fontFamily="Satoshi, system-ui, sans-serif"
                        fontSize={20} fontWeight={500}
                      >
                        {seg.footerCard.label}
                      </text>
                    )}
                    {bodyLines.map((line, idx) => (
                      <text
                        key={idx}
                        x={130} y={footerY + labelHeight + 33 + idx * 40}
                        fill="white"
                        fontFamily="Satoshi, system-ui, sans-serif"
                        fontSize={26} fontWeight={700}
                      >
                        {line}
                      </text>
                    ))}
                  </g>
                );
              })()}

              {seg.footerCard?.showRriveLogo && (
                <image
                  x={100} y={820}
                  width={240} height={130}
                  href={RRIVE_LOGO_DATA_URL}
                />
              )}
            </g>
          )}

          {/* Connector line segments — drawn BEFORE ticks so ticks sit on top */}
          {connectorSegments.map((s, i) => (
            <path key={i} d={`M${TICK_X} ${s.y1} V${s.y2}`} stroke={tokens.cyan} strokeWidth={4} />
          ))}

          {/* Rows */}
          {visibleRows.map((row, i) => {
            const st = resolvedGlow[i];
            const isGlowRow = st !== 'inactive';
            const p = rowProgress[i];
            return (
              <g key={row.id}>
                <JourneyRowComp
                  row={row}
                  y={ROW_YS[i]}
                  glow={isGlowRow}
                  glowProgress={p}
                  hideAvatars={!!seg.hideAvatars}
                />
              </g>
            );
          })}

        </g>{/* /camera transform */}
      </g>{/* /clip */}
    </svg>
  );
};

const JourneyRowComp: React.FC<{
  row: JourneyRow;
  y: number;
  glow: boolean;
  glowProgress?: number;
  hideAvatars?: boolean;
}> = ({ row, y, glow, glowProgress = 0, hideAvatars = false }) => {
  // Resolve persona data
  const ids = row.dual ? (row.personaIds || [null, null]).slice(0, 2) : [(row.personaIds || [null])[0]];
  let nameText = row.name || '';
  let designation = row.designation || '';
  if (!row.name) {
    if (row.dual && ids.length === 2) {
      const p1 = getPersonaById(ids[0]);
      const p2 = getPersonaById(ids[1]);
      if (p1 && p2) nameText = `${p1.name} & ${p2.name}`;
    } else {
      const p = getPersonaById(ids[0]);
      if (p) nameText = p.name;
    }
  }
  if (!designation) {
    const p = getPersonaById(ids[0]);
    if (p) designation = p.designation;
  }

  // Text x position — shifts left when dual avatar to make room
  const nameTextEndX = row.dual ? AVATAR_X - 92 : AVATAR_X - 56;

  return (
    <g>
      {/* Name + designation (text-anchor end so they align to the right of the text block) */}
      {nameText && (
        <text
          x={nameTextEndX} y={y - 8}
          textAnchor="end"
          fill="white"
          fontFamily="Satoshi, system-ui, sans-serif"
          fontSize={30} fontWeight={700}
        >
          {nameText}
        </text>
      )}
      {designation && (designation.split('\n').map((line, li) => (
        <text
          key={li}
          x={nameTextEndX} y={y + 21 + li * 22}
          textAnchor="end"
          fill={tokens.cyan}
          fontFamily="Satoshi, system-ui, sans-serif"
          fontSize={18} fontWeight={700}
        >
          {line}
        </text>
      )))}

      {/* Avatar(s) — render via foreignObject to support image circles, OR plain placeholder */}
      {hideAvatars ? null : row.useCustomIcon && row.customIconUrl ? (
        <RowCustomIcon iconUrl={row.customIconUrl} y={y} />
      ) : row.dual ? (
        <RowDualAvatar ids={ids} y={y} />
      ) : (
        <RowSingleAvatar id={ids[0]} y={y} />
      )}

      {/* Tick mark — editor-accurate two-layer glow:
          (1) always-on inactive ring as the base
          (2) animated glow overlay on top, opacity + scale tied to glowProgress.
          When glowProgress is 0, only the inactive ring shows — so the glow
          animates IN per row instead of being statically lit. */}
      <circle cx={TICK_X} cy={y} r={19.92} fill="#032444" stroke="#7ABEFF" strokeWidth={4} />
      {glow && glowProgress > 0.001 && (() => {
        const haloR = 65 * glowProgress;
        const innerS = 0.6 + 0.4 * glowProgress;
        const haloId = `halo-${TICK_X}-${y}`.replace(/\./g, '_');
        return (
          <g>
            <defs>
              <radialGradient id={haloId} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#7ABEFF" stopOpacity="0.7" />
                <stop offset="35%" stopColor="#7ABEFF" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#7ABEFF" stopOpacity="0" />
              </radialGradient>
            </defs>
            <circle cx={TICK_X} cy={y} r={haloR} fill={`url(#${haloId})`} />
            <g
              transform={`translate(${TICK_X} ${y}) scale(${innerS}) translate(${-TICK_X} ${-y})`}
              opacity={glowProgress}
            >
              <circle cx={TICK_X} cy={y} r={19.92} fill="#0183FF" stroke="#7ABEFF" strokeWidth={4} />
              <circle cx={TICK_X} cy={y} r={14.39} fill="white" />
              <path
                d={`M${TICK_X + 5.78},${y - 3.32} L${TICK_X - 0.86},${y + 3.35} L${TICK_X - 3.87},${y + 0.33}`}
                stroke="black" strokeWidth={3} fill="none"
                strokeLinecap="round" strokeLinejoin="round"
              />
            </g>
          </g>
        );
      })()}

      {/* Description text — multi-line, matches editor renderJourneySVG: split on
          \n, fallback word-wrap at 30 chars, LINE_HEIGHT 36, vertically centered
          on (y + 11). Previously a single <text> ignored newlines so multi-line
          descriptions collapsed to one line in the MP4. */}
      {row.description && (() => {
        const MAX_CHARS_PER_LINE = 30;
        const LINE_HEIGHT = 36;
        const desc = String(row.description);
        let lines: string[];
        if (desc.includes('\n')) {
          lines = desc.split('\n');
        } else {
          const words = desc.split(/\s+/);
          lines = [];
          let current = '';
          for (const w of words) {
            const candidate = current ? (current + ' ' + w) : w;
            if (candidate.length > MAX_CHARS_PER_LINE && current) {
              lines.push(current);
              current = w;
            } else {
              current = candidate;
            }
          }
          if (current) lines.push(current);
        }
        const totalH = (lines.length - 1) * LINE_HEIGHT;
        const startY = (y + 11) - totalH / 2;
        return lines.map((line, li) => (
          <text
            key={li}
            x={1320} y={startY + li * LINE_HEIGHT}
            fill="white"
            fontFamily="Satoshi, system-ui, sans-serif"
            fontSize={30} fontWeight={700}
          >
            {line}
          </text>
        ));
      })()}
    </g>
  );
};

// Avatar helpers — these draw circles + foreign image inside

const RowSingleAvatar: React.FC<{ id: string | null; y: number }> = ({ id, y }) => {
  const persona = getPersonaById(id);
  return (
    <g>
      {/* Clip path for circular avatar */}
      <defs>
        <clipPath id={`av-clip-${y}`}>
          <circle cx={AVATAR_X} cy={y} r={AVATAR_R} />
        </clipPath>
      </defs>
      <circle cx={AVATAR_X} cy={y} r={AVATAR_R} fill={tokens.avatarPlaceholder} />
      {persona && (
        <image
          x={AVATAR_X - AVATAR_R} y={y - AVATAR_R}
          width={AVATAR_R * 2} height={AVATAR_R * 2}
          href={persona.url}
          clipPath={`url(#av-clip-${y})`}
          preserveAspectRatio="xMidYMid slice"
        />
      )}
    </g>
  );
};

const RowDualAvatar: React.FC<{ ids: (string | null)[]; y: number }> = ({ ids, y }) => {
  // Primary at AVATAR_X, secondary at AVATAR_X - 50 (overlap ~50%)
  const secondaryX = AVATAR_X - 50;
  const persona1 = getPersonaById(ids[0]);
  const persona2 = getPersonaById(ids[1]);
  return (
    <g>
      <defs>
        <clipPath id={`av-clip-${y}-2`}>
          <circle cx={secondaryX} cy={y} r={AVATAR_R} />
        </clipPath>
        <clipPath id={`av-clip-${y}-1`}>
          <circle cx={AVATAR_X} cy={y} r={AVATAR_R} />
        </clipPath>
      </defs>
      {/* Secondary avatar (behind, to the left) */}
      <circle cx={secondaryX} cy={y} r={AVATAR_R} fill={tokens.avatarPlaceholder} stroke="#002B54" strokeWidth={3} />
      {persona2 && (
        <image
          x={secondaryX - AVATAR_R} y={y - AVATAR_R}
          width={AVATAR_R * 2} height={AVATAR_R * 2}
          href={persona2.url}
          clipPath={`url(#av-clip-${y}-2)`}
          preserveAspectRatio="xMidYMid slice"
        />
      )}
      {/* Primary avatar (front, on the right) */}
      <circle cx={AVATAR_X} cy={y} r={AVATAR_R} fill={tokens.avatarPlaceholder} stroke="#002B54" strokeWidth={3} />
      {persona1 && (
        <image
          x={AVATAR_X - AVATAR_R} y={y - AVATAR_R}
          width={AVATAR_R * 2} height={AVATAR_R * 2}
          href={persona1.url}
          clipPath={`url(#av-clip-${y}-1)`}
          preserveAspectRatio="xMidYMid slice"
        />
      )}
    </g>
  );
};

const RowCustomIcon: React.FC<{ iconUrl: string; y: number }> = ({ iconUrl, y }) => (
  <g>
    <rect x={AVATAR_X - 41} y={y - 41} width={82} height={82} rx={10} fill="rgba(255,255,255,0.08)" />
    <image
      x={AVATAR_X - 30} y={y - 30}
      width={60} height={60}
      href={iconUrl}
      preserveAspectRatio="xMidYMid meet"
    />
  </g>
);
